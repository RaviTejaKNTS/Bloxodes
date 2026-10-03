#!/usr/bin/env python3
"""Correct approved variant labels without rebuilding frozen datasets or media."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'tmp/content-workspace/minecraft'
COLLECTIONS = ['items', 'recipes', 'villager-trades', 'armor-trims', 'music-discs']
FIELDS = {
    'items': {'name', 'uses', 'recipeRelationships'},
    'recipes': {'name', 'output', 'ingredients', 'pattern'},
    'villager-trades': {'name', 'outputs', 'inputs', 'basePrice'},
    'armor-trims': {'template', 'duplication', 'editionOverrides.bedrock.duplication'},
    'music-discs': {'itemName'},
}


def differences(before, after, prefix=''):
    if isinstance(before, dict) and isinstance(after, dict):
        if before.keys() != after.keys():
            raise ValueError('Variant correction changed field ownership: ' + prefix)
        return [change for key in before for change in differences(before[key], after[key], prefix + ('.' if prefix else '') + key)]
    return [] if before == after else [{'field': prefix, 'before': before, 'after': after}]


def set_field(item, field, value):
    keys = field.split('.')
    target = item
    for key in keys[:-1]:
        target = target[key]
    target[keys[-1]] = value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--receipt', default=str(WORK / 'qa/variant-name-correction/receipt.json'))
    args = parser.parse_args()
    proposal = json.loads((WORK / 'source-pack/references/item-variant-name-proposal.json').read_text())
    spec = importlib.util.spec_from_file_location('minecraft_collection_builder', ROOT / 'scripts/minecraft/build-minecraft-collections.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    updated_name = builder.name
    updated_ingredient = builder.human_ingredient

    def original_name(value):
        value = builder.sid(value)
        component = builder.COMPONENTS.get(value, {})
        translation = component.get('minecraft:item_name', {}).get('translate', '')
        return builder.LANG.get(translation, builder.LANG.get('block.minecraft.' + value, builder.LANG.get('item.minecraft.' + value, builder.title(value))))

    def original_ingredient(value):
        if isinstance(value, dict):
            raw = builder.sid(value.get('item', value.get('id', '')))
            parts = raw.split(':')
            auxiliary = value.get('data', int(parts[-1]) if len(parts) > 1 and parts[-1].lstrip('-').isdigit() else 0)
            raw = ':'.join(parts[:-1]) if len(parts) > 1 and parts[-1].lstrip('-').isdigit() else raw
            if (raw.lower(), auxiliary) in builder.BED_VARIANTS:
                return builder.BED_VARIANTS[raw.lower(), auxiliary]['localizedName']
        return updated_ingredient(value)

    for entry in proposal['names']:
        if updated_name(entry['id']) != entry['newName']:
            raise ValueError('Builder disagrees with approved translation for ' + entry['id'])

    generated = {}
    def capture(collection, rows, *unused, **ignored):
        generated[collection] = {row['system']['slug']: row['item'] for row in rows}
    builder.save = capture
    builder.SKIP_TOOL_EXPORT = True
    builder.name = original_name
    builder.human_ingredient = original_ingredient
    for collection in COLLECTIONS:
        builder.BUILDERS[collection]()
    baseline = copy.deepcopy(generated)
    builder.name = updated_name
    builder.human_ingredient = updated_ingredient
    for collection in COLLECTIONS:
        builder.BUILDERS[collection]()

    receipt = {'state': 'applied' if args.apply else 'plan', 'identityCount': 49, 'collections': {}}
    plans = {}
    for collection in COLLECTIONS:
        file = WORK / 'minecraft/collections' / collection / 'dataset.json'
        original_bytes = file.read_bytes()
        original = json.loads(original_bytes)
        corrected = copy.deepcopy(original)
        frozen = {row['system']['slug']: row for row in corrected['items']}
        if frozen.keys() != generated[collection].keys() or frozen.keys() != baseline[collection].keys():
            raise ValueError('The frozen roster differs from the pinned source: ' + collection)
        changes = []
        for slug in frozen:
            for change in differences(baseline[collection][slug], generated[collection][slug]):
                if change['field'] not in FIELDS[collection] or not isinstance(change['before'], str) or not isinstance(change['after'], str):
                    raise ValueError('Correction exceeded the approved display fields: ' + collection + '/' + slug + '/' + change['field'])
                target = frozen[slug]['item']
                for key in change['field'].split('.'):
                    target = target[key]
                if target != change['before']:
                    if collection == 'armor-trims' and change['field'] == 'editionOverrides.bedrock.duplication':
                        identity = slug.replace('-', '_') + '_armor_trim_smithing_template'
                        source = next(entry for entry in proposal['names'] if entry['id'] == identity)
                        old_ingredient = '1 × ' + source['oldName']
                        new_ingredient = '1 × ' + source['newName']
                        if target.count(old_ingredient) != 1 or change['before'].count(old_ingredient) != 1 or change['after'].count(new_ingredient) != 1:
                            raise ValueError('The exact source-defined template ingredient is ambiguous.')
                        change = {**change, 'before': target, 'after': target.replace(old_ingredient, new_ingredient, 1)}
                    else:
                        raise ValueError('Frozen display field changed since source approval: ' + collection + '/' + slug + '/' + change['field'] + ': ' + repr(target) + ' != ' + repr(change['before']))
                set_field(frozen[slug]['item'], change['field'], change['after'])
                changes.append({'slug': slug, **change})
        for before, after in zip(original['items'], corrected['items']):
            if before['system'] != after['system']:
                raise ValueError('Correction changed media or identity fields.')
            for key in ['imageCreditUrl', 'imageSource', 'sourceImageUrl']:
                if before['item'].get(key) != after['item'].get(key):
                    raise ValueError('Correction changed image attribution.')
        after_bytes = (json.dumps(corrected, ensure_ascii=False, indent=2) + '\n').encode()
        plans[collection] = (file, original_bytes, after_bytes)
        receipt['collections'][collection] = {'count': len(original['items']), 'beforeSha256': hashlib.sha256(original_bytes).hexdigest(), 'afterSha256': hashlib.sha256(after_bytes).hexdigest(), 'changes': changes, 'mediaAndIdsUnchanged': True}

    output = Path(args.receipt)
    output.parent.mkdir(parents=True, exist_ok=True)
    if args.apply:
        for collection, (file, before, after) in plans.items():
            if file.read_bytes() != before:
                raise ValueError('Dataset changed during correction: ' + collection)
        for collection, (file, before, after) in plans.items():
            (output.parent / (collection + '.before.json')).write_bytes(before)
            (output.parent / (collection + '.after.json')).write_bytes(after)
            temporary = file.with_suffix('.variant-correction.json')
            temporary.write_bytes(after)
            temporary.replace(file)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'receipt': str(output), 'state': receipt['state'], 'collections': {key: {'count': value['count'], 'changedFields': len(value['changes']), 'afterSha256': value['afterSha256']} for key, value in receipt['collections'].items()}}, indent=2))


if __name__ == '__main__':
    main()
