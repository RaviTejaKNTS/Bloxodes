#!/usr/bin/env python3
"""Render pinned Mojang assets for authoring. This script never uploads or publishes."""
import argparse
import functools
import hashlib
import json
import math
import re
import shutil
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance


class UnsupportedAsset(Exception):
    pass


def read_json(path):
    return json.loads(Path(path).read_text())


def rotation(point, angles, pivot=(0, 0, 0)):
    x, y, z = [point[i] - pivot[i] for i in range(3)]
    for axis, angle in enumerate(angles):
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        if axis == 0:
            y, z = y*c-z*s, y*s+z*c
        elif axis == 1:
            x, z = x*c+z*s, -x*s+z*c
        else:
            x, y = x*c-y*s, x*s+y*c
    return [x+pivot[0], y+pivot[1], z+pivot[2]]


def camera(point, angles):
    # Minecraft GUI transforms rotate around Y before the camera pitch.
    return rotation(rotation(point, [0, angles[1], 0]), [angles[0], 0, angles[2]])


def quaternion_rotate(point, quaternion):
    x,y,z,w=quaternion
    norm=math.sqrt(x*x+y*y+z*z+w*w)
    if not norm:raise UnsupportedAsset('Invalid item transform quaternion')
    x,y,z,w=x/norm,y/norm,z/norm,w/norm
    px,py,pz=point
    tx,ty,tz=2*(y*pz-z*py),2*(z*px-x*pz),2*(x*py-y*px)
    return [px+w*tx+y*tz-z*ty,py+w*ty+z*tx-x*tz,pz+w*tz+x*ty-y*tx]


def item_transform(point, transform):
    centered=[(coordinate-8)/16 for coordinate in point]
    centered=quaternion_rotate(centered,transform.get('right_rotation',[0,0,0,1]))
    centered=[centered[i]*transform.get('scale',[1,1,1])[i] for i in range(3)]
    centered=quaternion_rotate(centered,transform.get('left_rotation',[0,0,0,1]))
    return [8+16*(centered[i]+transform.get('translation',[0,0,0])[i]) for i in range(3)]


def face_vertices(a, b):
    x, y, z = a
    X, Y, Z = b
    # Each face is top-left, top-right, bottom-right, bottom-left viewed outside.
    return {
        'north': [[X,Y,z],[x,Y,z],[x,y,z],[X,y,z]],
        'south': [[x,Y,Z],[X,Y,Z],[X,y,Z],[x,y,Z]],
        'west': [[x,Y,z],[x,Y,Z],[x,y,Z],[x,y,z]],
        'east': [[X,Y,Z],[X,Y,z],[X,y,z],[X,y,Z]],
        'up': [[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],
        'down': [[x,y,Z],[X,y,Z],[X,y,z],[x,y,z]],
    }


def tint_image(image, color):
    rgba = image.convert('RGBA')
    red, green, blue, alpha = rgba.split()
    channels = [red, green, blue]
    for i, multiplier in enumerate(color[:3]):
        channels[i] = channels[i].point(lambda v: round(v*multiplier/255))
    return Image.merge('RGBA', (*channels, alpha))


def crop_uv(texture, uv, dimensions=(16, 16), mirror=False, turn=0):
    u, v, U, V = uv
    w, h = dimensions
    # Java animated assets display their first frame; geometry uses the logical atlas dimensions.
    box = (round(min(u,U)*texture.width/w), round(min(v,V)*texture.height/h),
           round(max(u,U)*texture.width/w), round(max(v,V)*texture.height/h))
    if box[0] == box[2] or box[1] == box[3]:
        raise UnsupportedAsset('Degenerate texture UV rectangle')
    image = texture.crop(box)
    if u > U or mirror:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if v > V:
        image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    if turn:
        image = image.rotate(-turn, expand=True)
    return image


def render_faces(faces, size=256, angles=(30, 225, 0), lighting=True):
    projected = []
    for vertices, texture, label in faces:
        points = [camera(v, angles) for v in vertices]
        # Cull faces whose outward normal points away from the viewer.
        dx1,dy1 = points[1][0]-points[0][0], points[1][1]-points[0][1]
        dx2,dy2 = points[3][0]-points[0][0], points[3][1]-points[0][1]
        if dx1*dy2-dy1*dx2 >= -1e-8:
            continue
        projected.append((points, texture, label))
    if not projected:
        raise UnsupportedAsset('No visible model faces')
    xs = [p[0] for f,_,_ in projected for p in f]
    ys = [p[1] for f,_,_ in projected for p in f]
    cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
    scale = size*.82/max(max(xs)-min(xs), max(ys)-min(ys), .001)
    canvas = Image.new('RGBA', (size,size))
    for points,texture,label in sorted(projected, key=lambda f: sum(p[2] for p in f[0])/4):
        p = [(size/2+(q[0]-cx)*scale,size/2-(q[1]-cy)*scale) for q in points]
        ax,ay = p[1][0]-p[0][0],p[1][1]-p[0][1]
        bx,by = p[3][0]-p[0][0],p[3][1]-p[0][1]
        determinant=ax*by-ay*bx
        if abs(determinant)<1e-8:
            continue
        # Inverse affine transform maps a screen pixel back to a face's texture.
        a,b = by/determinant*texture.width,-bx/determinant*texture.width
        d,e = -ay/determinant*texture.height,ax/determinant*texture.height
        c,f = -a*p[0][0]-b*p[0][1],-d*p[0][0]-e*p[0][1]
        if lighting:
            texture=ImageEnhance.Brightness(texture).enhance({'up':1,'down':.5,'north':.82,'south':.82,'west':.67,'east':.67}.get(label,.9))
        face=texture.transform((size,size),Image.Transform.AFFINE,(a,b,c,d,e,f),Image.Resampling.NEAREST)
        canvas.alpha_composite(face)
    return canvas


class AssetRenderer:
    def __init__(self, source, size=256):
        self.source=Path(source)
        self.java=self.source/'java/assets'
        self.bedrock=self.source/'bedrock/resource_pack'
        self.size=size
        self.components=read_json(self.source/'java/summary/item_components/data.json')
        self.mob_index={x['id']:x for x in read_json(self.source/'mob-roster-and-model-index.json')['mobTypes']}

    @functools.lru_cache(maxsize=4000)
    def model(self, name):
        name=name.removeprefix('minecraft:')
        if name.startswith('builtin/'):
            return {'builtin':name,'textures':{}}
        path=self.java/'models'/f'{name}.json'
        if not path.is_file():
            raise UnsupportedAsset(f'Missing Java model {name}')
        child=read_json(path)
        merged=dict(self.model(child['parent'])) if 'parent' in child else {}
        merged.update(child)
        for key in ('textures','display'):
            merged[key]={**(self.model(child['parent']).get(key,{}) if 'parent' in child else {}),**child.get(key,{})}
        return merged

    @functools.lru_cache(maxsize=3000)
    def texture(self, name):
        path=self.java/'textures'/f'{name.removeprefix("minecraft:")}.png'
        if not path.is_file():
            raise UnsupportedAsset(f'Missing Java texture {name}')
        image=Image.open(path).convert('RGBA')
        if Path(str(path)+'.mcmeta').is_file() and image.height>image.width:
            image=image.crop((0,0,image.width,image.width))
        return image

    def resolve_texture(self, name, model):
        seen=set()
        while isinstance(name,str) and name.startswith('#'):
            if name in seen:
                raise UnsupportedAsset('Cyclic model texture reference')
            seen.add(name)
            name=model['textures'][name[1:]]
        if isinstance(name,str) and name in model['textures']:
            return self.resolve_texture('#'+name,model)
        if isinstance(name,dict):
            if 'sprite' in name:
                name=name['sprite']
            elif name.get('type')=='minecraft:single':
                name=name['texture']
            else:
                raise UnsupportedAsset(f'Texture source needs an atlas renderer: {name}')
        return self.texture(name)

    def tints(self, definitions, override=None):
        colors=[]
        for definition in definitions:
            kind=definition['type'].removeprefix('minecraft:')
            value=definition.get('value',definition.get('default',0xFFFFFF))
            if kind=='grass':
                temp=definition.get('temperature',.5)
                rain=definition.get('downfall',1)*temp
                colors.append(self.texture('colormap/grass').getpixel((int((1-temp)*255),int((1-rain)*255)))[:3])
            elif override is not None and kind in ('potion','dye','constant'):
                colors.append(override)
            else:
                colors.append(((value>>16)&255,(value>>8)&255,value&255))
        return colors

    def item_node(self,node):
        kind=node['type'].removeprefix('minecraft:')
        if kind=='model':
            return [node]
        if kind=='select' and node.get('property')=='minecraft:display_context':
            for case in node.get('cases',[]):
                contexts=case['when'] if isinstance(case['when'],list) else [case['when']]
                if 'gui' in contexts:
                    return self.item_node(case['model'])
        if kind=='range_dispatch' and 'fallback' not in node and node.get('entries'):
            # Show the source-defined first frame of animated clock and compass inventory icons.
            return self.item_node(node['entries'][0]['model'])
        if kind in ('select','range_dispatch'):
            if 'fallback' not in node:
                raise UnsupportedAsset(f'{kind} has no deterministic fallback')
            return self.item_node(node['fallback'])
        if kind=='condition':
            return self.item_node(node['on_false'])
        if kind=='composite':
            return [n for child in node['models'] for n in self.item_node(child)]
        if kind=='empty':
            return []
        raise UnsupportedAsset(f'Java item model type {kind} needs its dedicated renderer')

    def java_item(self,item,color=None,model_override=None):
        if self.components.get(item,{}).get('minecraft:enchantment_glint_override'):
            raise UnsupportedAsset('Default inventory item has enchantment glint; exact glint-rendered reference required')
        if model_override is None:
            definition=read_json(self.java/'items'/f'{item}.json')
            nodes=self.item_node(definition['model'])
        else:
            # A caller must identify the exact blockstate model; inventory item aliases are not inferred.
            nodes=model_override if isinstance(model_override,list) else [{'model':model_override}]
        sprite=Image.new('RGBA',(self.size,self.size))
        faces=[]
        angles=(30,225,0)
        for node in nodes:
            model=self.model(node['model'])
            colors=self.tints(node.get('tints',[]),color)
            if model.get('builtin')=='builtin/generated':
                for index in range(20):
                    name=model.get('textures',{}).get(f'layer{index}')
                    if name is None:
                        break
                    layer=self.resolve_texture(name,model).copy()
                    if index<len(colors):
                        layer=tint_image(layer,colors[index])
                    factor=min(self.size*.82/layer.width,self.size*.82/layer.height)
                    layer=layer.resize((round(layer.width*factor),round(layer.height*factor)),Image.Resampling.NEAREST)
                    sprite.alpha_composite(layer,((self.size-layer.width)//2,(self.size-layer.height)//2))
                continue
            elements=model.get('elements')
            if not elements:
                raise UnsupportedAsset(f'Java model {node["model"]} has no static elements')
            angles=model.get('display',{}).get('gui',{}).get('rotation',angles)
            for element in elements:
                vertices=face_vertices(element['from'],element['to'])
                for side,face in element['faces'].items():
                    # A native plane has zero-area edge faces. They have no pixels to render.
                    corners=vertices[side]
                    edge_a=[corners[1][i]-corners[0][i] for i in range(3)]
                    edge_b=[corners[3][i]-corners[0][i] for i in range(3)]
                    area=[edge_a[1]*edge_b[2]-edge_a[2]*edge_b[1], edge_a[2]*edge_b[0]-edge_a[0]*edge_b[2], edge_a[0]*edge_b[1]-edge_a[1]*edge_b[0]]
                    if sum(value*value for value in area)==0:
                        continue
                    uv=face.get('uv')
                    if uv is None:
                        a,b=element['from'],element['to']
                        uv={'down':[a[0],16-b[2],b[0],16-a[2]],'up':[a[0],a[2],b[0],b[2]],'north':[16-b[0],16-b[1],16-a[0],16-a[1]],'south':[a[0],16-b[1],b[0],16-a[1]],'west':[a[2],16-b[1],b[2],16-a[1]],'east':[16-b[2],16-b[1],16-a[2],16-a[1]]}[side]
                    texture=crop_uv(self.resolve_texture(face['texture'],model),uv,turn=face.get('rotation',0))
                    ti=face.get('tintindex',-1)
                    if 0<=ti<len(colors):
                        texture=tint_image(texture,colors[ti])
                    points=vertices[side]
                    if 'rotation' in element:
                        r=element['rotation']
                        angle=[0,0,0]
                        axis='xyz'.index(r['axis'])
                        angle[axis]=r['angle']
                        if r.get('rescale'):
                            factor=1/math.cos(math.radians(r['angle']))
                            points=[[r['origin'][i]+(p[i]-r['origin'][i])*(1 if i==axis else factor) for i in range(3)] for p in points]
                        points=[rotation(p,angle,r['origin']) for p in points]
                    if node.get('transformation'):
                        points=[item_transform(p,node['transformation']) for p in points]
                    faces.append((points,texture,side))
        if faces:
            sprite.alpha_composite(render_faces(faces,self.size,angles))
        if sprite.getbbox() is None:
            raise UnsupportedAsset('Empty rendered item')
        return sprite

    def decorated_pot(self, decorations):
        # Geometry and UVs follow pinned client26.3 DecoratedPotRenderer.createBaseLayer/createSidesLayer.
        directory=self.java/'textures'/'entity'/'decorated_pot'
        base=Image.open(directory/'decorated_pot_base.png').convert('RGBA')
        faces=[]
        for side in ('north','south','west','east'):
            part={'north':'back','south':'front','west':'left','east':'right'}[side]
            item=decorations.get(part,{}).get('id','minecraft:brick').split(':')[-1]
            filename=item.replace('_pottery_sherd','_pottery_pattern') if item.endswith('_pottery_sherd') else 'decorated_pot_side'
            texture=Image.open(directory/f'{filename}.png').convert('RGBA').crop((1,0,15,16))
            faces.append((face_vertices([1,0,1],[15,16,15])[side],texture,side))
        plane=base.crop((0,13,14,27))
        for side in ('up','down'):
            faces.append((face_vertices([1,0,1],[15,16,15])[side],plane,side))
        for origin,dimensions,offset,inflate in [([4,17,4],[8,3,8],[0,0],-.1),([5,20,5],[6,1,6],[0,5],.2)]:
            u,v=offset;w,h,d=dimensions
            rectangles={'west':[u,v+d,u+d,v+d+h],'north':[u+d,v+d,u+d+w,v+d+h],'east':[u+d+w,v+d,u+2*d+w,v+d+h],'south':[u+2*d+w,v+d,u+2*d+2*w,v+d+h],'up':[u+d,v,u+d+w,v+d],'down':[u+d+w,v,u+d+2*w,v+d]}
            vertices=face_vertices([x-inflate for x in origin],[origin[i]+dimensions[i]+inflate for i in range(3)])
            for side,uv in rectangles.items():
                points=[[p[0],37-p[1],16-p[2]] for p in vertices[side]]
                faces.append((points,crop_uv(base,uv,(32,32)),{'up':'down','down':'up','north':'south','south':'north'}.get(side,side)))
        return render_faces(faces,self.size,(30,45,0),lighting=False)

    def potion(self, identifier, item_type='potion'):
        identifier=identifier.replace('-','_')
        if identifier in ('decay','long_mundane'):
            filename='potion_bottle_wither' if identifier=='decay' else 'potion_bottle_drinkable'
            source=self.bedrock/'textures/items'/f'{filename}.png'
            image=Image.open(source).convert('RGBA')
            image=image.resize((round(self.size*.82),round(self.size*.82)),Image.Resampling.NEAREST)
            canvas=Image.new('RGBA',(self.size,self.size))
            canvas.alpha_composite(image,((self.size-image.width)//2,(self.size-image.height)//2))
            return canvas,{'edition':'bedrock','sourceAsset':str(source),'variant':identifier}
        potion_code=(self.source/'java/code/world/item/alchemy/Potions.java').read_text()
        effect_code=(self.source/'java/code/world/effect/MobEffects.java').read_text()
        definitions=dict(re.findall(r'^\s*(\w+) = register\(PotionIds\.\w+, new Potion\((.*?)\)\);',potion_code,re.M))
        body=definitions.get(identifier.upper())
        if body is None:
            raise UnsupportedAsset(f'No pinned Java potion definition for {identifier}')
        colors={name:int(value) for name,value in re.findall(r'^\s*(\w+) = register\([^\n]*?MobEffectCategory\.\w+, (\d+)',effect_code,re.M)}
        effects=[(name,int(amplifier or 0)+1) for name,amplifier in re.findall(r'new MobEffectInstance\(MobEffects\.(\w+), \d+(?:, (\d+))?\)',body)]
        if effects:
            weight=sum(amplifier for _,amplifier in effects)
            rgb=[sum(((colors[name]>>shift)&255)*amplifier for name,amplifier in effects)//weight for shift in (16,8,0)]
        else:
            # PotionContents.getColorOr uses this value when no visible effect contributes.
            value=-13083194
            rgb=[(value>>shift)&255 for shift in (16,8,0)]
        return self.java_item(item_type,tuple(rgb)),{'edition':'java','variant':identifier,'rgb':rgb,'effectWeights':effects,'sourceAssets':['java/code/world/item/alchemy/Potions.java','java/code/world/effect/MobEffects.java','java/code/world/item/alchemy/PotionContents.java',f'java/assets/items/{item_type}.json']}

    def mob(self,mob):
        entry=self.mob_index[mob]
        if not entry.get('models'):
            raise UnsupportedAsset('No Bedrock model for this exact mob')
        model=next((value for value in entry['models'] if Path(value['file']).name==f'{mob}.entity.json'),entry['models'][0])
        entity_path=self.bedrock/'entity'/f'{mob}.entity.json'
        if not entity_path.is_file():
            entity_path=self.source/model['file']
        entity=read_json(entity_path)['minecraft:client_entity']['description']
        default_id=entity.get('geometry',{}).get('default')
        geo=next((value for value in model['geometries'].values() if value.get('id')==default_id),None)
        if geo is None:
            for path in sorted((self.bedrock/'models/entity').glob('*.json')):
                raw_geo=read_json(path)
                ids=[value['description']['identifier'] for value in raw_geo.get('minecraft:geometry',[])] or list(raw_geo)
                if default_id in ids:
                    geo={'id':default_id,'file':str(path.relative_to(self.source))}
                    break
        if geo is None:
            raise UnsupportedAsset(f'Actual client entity default geometry {default_id} is unresolved')
        if not geo.get('file'):
            raise UnsupportedAsset('Mob geometry source is unresolved')
        raw=read_json(self.source/geo['file'])
        if 'minecraft:geometry' in raw:
            matches=[g for g in raw['minecraft:geometry'] if g['description']['identifier']==geo['id']]
            if not matches:
                raise UnsupportedAsset('Geometry identifier is absent from its source')
            geometry=matches[0]
            desc=geometry['description']
            dimensions=(desc.get('texture_width'),desc.get('texture_height'))
        else:
            geometry=raw[geo['id']]
            dimensions=(geometry.get('texturewidth'),geometry.get('textureheight'))
        textures=entity.get('textures',model['textures'])
        texture_name=textures.get('default',next(iter(textures.values())))
        texture_path=self.bedrock/(texture_name+'.png')
        if not texture_path.is_file():
            texture_path=self.bedrock/(texture_name+'.tga')
        texture=Image.open(texture_path).convert('RGBA')
        dimensions=(dimensions[0] or texture.width,dimensions[1] or texture.height)
        if mob=='ocelot':
            texture=Image.open(self.bedrock/(textures['wild']+'.png')).convert('RGBA')
        if mob=='villager' and 'plains' in textures:
            texture.alpha_composite(Image.open(self.bedrock/(textures['plains']+'.png')).convert('RGBA'))
        bones={b['name']:b for b in geometry['bones']}
        def transform(point,bone):
            current=bone
            seen=set()
            while current:
                if current['name'] in seen:
                    raise UnsupportedAsset('Cyclic bone hierarchy')
                seen.add(current['name'])
                # bind_pose_rotation describes animation bind pose, not an added rest rotation.
                point=rotation(point,[-v for v in current.get('rotation',[0,0,0])],current.get('pivot',[0,0,0]))
                current=bones.get(current.get('parent'))
            return point
        faces=[]
        for bone in bones.values():
            if bone.get('neverRender'):
                continue
            for cube in bone.get('cubes',[]):
                if 'poly_mesh' in cube:
                    raise UnsupportedAsset('Polygon mob geometry needs a mesh renderer')
                origin=cube['origin']; size=cube['size']
                inflate=cube.get('inflate',bone.get('inflate',0))
                vertices=face_vertices([v-inflate for v in origin],[origin[i]+size[i]+inflate for i in range(3)])
                uv=cube.get('uv',[0,0]); mirror=cube.get('mirror',bone.get('mirror',False))
                if isinstance(uv,list):
                    u,v=uv; w,h,d=size
                    rectangles={'west':[u,v+d,u+d,v+d+h],'north':[u+d,v+d,u+d+w,v+d+h],'east':[u+d+w,v+d,u+2*d+w,v+d+h],'south':[u+2*d+w,v+d,u+2*d+2*w,v+d+h],'up':[u+d,v,u+d+w,v+d],'down':[u+d+w,v,u+d+2*w,v+d]}
                else:
                    rectangles={face:[*data['uv'],data['uv'][0]+data.get('uv_size',[size[0],size[1]])[0],data['uv'][1]+data.get('uv_size',[size[0],size[1]])[1]] for face,data in uv.items()}
                for side,rectangle in rectangles.items():
                    if min(abs(rectangle[2]-rectangle[0]),abs(rectangle[3]-rectangle[1]))<=0:
                        continue
                    points=vertices[side]
                    if 'rotation' in cube:
                        points=[rotation(p,[-v for v in cube['rotation']],cube.get('pivot',[origin[i]+size[i]/2 for i in range(3)])) for p in points]
                    points=[transform(p,bone) for p in points]
                    faces.append((points,crop_uv(texture,rectangle,dimensions,mirror),side))
        return render_faces(faces,self.size,(18,145,0))

    def hub(self,output):
        output.mkdir(parents=True,exist_ok=True)
        grass=Image.open(self.bedrock/'pack_icon.png').convert('RGBA')
        grass.save(output/'minecraft-hero.webp',lossless=True)
        # Reconstruct the title cubemap, using Java's panorama orientation and 90-degree faces.
        tiles=[Image.open(self.java/f'textures/gui/title/background/panorama_{i}.png').convert('RGB') for i in range(6)]
        if min(min(tile.size) for tile in tiles)<256:
            raise UnsupportedAsset('Title panorama files are placeholders, not full-resolution source images')
        width,height=1200,675
        image=Image.new('RGB',(width,height))
        pixels=image.load()
        for y in range(height):
            for x in range(width):
                ray=((x+.5-width/2)/(width/2),-(y+.5-height/2)/(width/2),1)
                # Minecraft panorama front looks onto panorama_0 with neighboring faces 1 and 3.
                px,py,pz=rotation(ray,[0,-100,0])
                dominant=max(abs(px),abs(py),abs(pz))
                if abs(pz)==dominant:
                    face=0 if pz>0 else 2; u=px/abs(pz) if pz>0 else -px/abs(pz); v=-py/abs(pz)
                elif abs(px)==dominant:
                    face=1 if px>0 else 3; u=-pz/abs(px) if px>0 else pz/abs(px); v=-py/abs(px)
                else:
                    face=4 if py>0 else 5; u=px/abs(py); v=pz/abs(py) if py>0 else -pz/abs(py)
                tile=tiles[face]
                pixels[x,y]=tile.getpixel((min(tile.width-1,max(0,int((u+1)*tile.width/2))),min(tile.height-1,max(0,int((v+1)*tile.height/2)))))
        image.save(output/'minecraft-cover.webp',quality=90,method=6)
        return {'hero':'bedrock/resource_pack/pack_icon.png','cover':[f'java/assets/textures/gui/title/background/panorama_{i}.png' for i in range(6)]}


def render_collection(renderer, workspace, references=None, aliases=None):
    workspace=Path(workspace)
    brief=(workspace/'brief.md').read_text()
    if '## Parent data review' not in brief or not any(marker in brief for marker in ('Approved for the image stage','Approved for images')):
        raise ValueError('Collection image pass requires recorded parent data approval')
    dataset_path=workspace/'dataset.json'
    dataset=read_json(dataset_path)
    media=workspace/'media';media.mkdir(exist_ok=True)
    report={'collection':dataset['meta']['collection'],'target':len(dataset['items']),'images':[],'missing':[],
            'sourcePack':str(renderer.source/'manifest.json'),
            'processing':'Official Java 26.3 inventory model with GUI context, first-frame texture mapping and nearest-neighbor pixel rendering. Lossless WebP.',
            'licensing':'Mojang game assets retain their copyright. These derived identifying images require the site owner to retain source attribution and review permitted use.'}
    references=references or {};aliases=aliases or {}
    for row in dataset['items']:
        slug=row['system']['slug'];identifier=slug.replace('-','_')
        collection=dataset['meta']['collection']
        if collection=='armor-trims':
            identifier=f'{identifier}_armor_trim_smithing_template'
        elif collection=='music-discs':
            identifier=f'music_disc_{identifier}'
        try:
            color_proof=None
            if collection=='status-effects':
                # Effect HUD sprites have their own identity, separate from potion inventory items.
                source=renderer.java/'textures'/'mob_effect'/f'{identifier}.png'
                if not source.is_file():
                    raise UnsupportedAsset(f'No pinned Java HUD effect sprite for {identifier}')
                image=Image.open(source).convert('RGBA')
            elif collection=='potions':
                image,color_proof=renderer.potion(identifier)
                identifier='potion'
            else:
                image=renderer.java_item(identifier)
            file=media/f'{slug}.webp';image.save(file,lossless=True)
            row['system']['image']=f'media/{slug}.webp'
            report['images'].append({'slug':slug,'path':row['system']['image'],
                                    'sourcePage':'https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3',
                                    'sourceUrl':'https://piston-data.mojang.com/v1/objects/e877b6a07acd633fb3bb475002175cec036e7b87/client.jar',
                                    'sourceAsset':f'assets/minecraft/textures/mob_effect/{identifier}.png' if collection=='status-effects' else f'assets/minecraft/items/{identifier}.json',
                                    'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'exactMatch':True,
                                    **({'colorProof':color_proof} if color_proof else {})})
        except (UnsupportedAsset,KeyError,FileNotFoundError,ValueError) as error:
            mapping=aliases.get(slug,{})
            reference=references.get(mapping.get('sourceSlug',slug))
            if reference and reference.get('status')!='gap':
                source=Path(reference['image'])
                if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=reference['sha256']:
                    raise ValueError(f'Exact reference bytes changed for {slug}')
                if not reference['sourcePage'].startswith('https://minecraft.wiki/w/'):
                    raise ValueError(f'Invalid canonical image credit for {slug}')
                file=media/f'{slug}.webp';shutil.copyfile(source,file)
                row['system']['image']=f'media/{slug}.webp'
                row['item']['imageCreditUrl']=reference['sourcePage']
                report['images'].append({**reference,'slug':slug,'path':row['system']['image'],
                                        'exactMatch':True,'officialRendererGap':str(error),
                                        'visualAlias':mapping.get('visualAlias',reference.get('visualAlias'))})
            else:
                report['missing'].append({'slug':slug,'reason':str(error)})
    dataset_path.write_text(json.dumps(dataset,indent=2)+'\n')
    (workspace/'images.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',default='tmp/content-workspace/minecraft/source-pack')
    parser.add_argument('--output',required=True)
    parser.add_argument('--item',action='append',default=[])
    parser.add_argument('--mob',action='append',default=[])
    parser.add_argument('--potion',action='append',default=[])
    parser.add_argument('--all-items',action='store_true')
    parser.add_argument('--all-mobs',action='store_true')
    parser.add_argument('--hub',action='store_true')
    parser.add_argument('--size',type=int,default=256)
    parser.add_argument('--collection-workspace')
    parser.add_argument('--reference-manifest',action='append',default=[])
    parser.add_argument('--image-aliases',help='Explicit reviewed representative image aliases, keyed by frozen item slug')
    args=parser.parse_args()
    renderer=AssetRenderer(args.source,args.size)
    output=Path(args.output); output.mkdir(parents=True,exist_ok=True)
    report={'sourcePack':str(renderer.source),'renders':[],'unsupported':[]}
    if args.collection_workspace:
        references={}
        for manifest in args.reference_manifest:
            for reference in read_json(manifest)['images']:
                if reference['slug'] in references:
                    raise ValueError(f'Duplicate reference identity {reference["slug"]}')
                references[reference['slug']]=reference
        aliases=read_json(args.image_aliases) if args.image_aliases else {}
        result=render_collection(renderer,args.collection_workspace,references,aliases)
        print(json.dumps({'collection':result['collection'],'images':len(result['images']),'missing':result['missing']}))
        return
    if args.hub:
        report['hub']=renderer.hub(output)
    items=[p.stem for p in sorted((renderer.java/'items').glob('*.json'))] if args.all_items else args.item
    mobs=sorted(renderer.mob_index) if args.all_mobs else args.mob
    for kind,identifiers in [('item',items),('mob',mobs)]:
        for identifier in identifiers:
            try:
                image=renderer.java_item(identifier) if kind=='item' else renderer.mob(identifier)
                path=output/f'{kind}-{identifier}.webp'
                image.save(path,lossless=True)
                report['renders'].append({'kind':kind,'id':identifier,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
            except (UnsupportedAsset,KeyError,FileNotFoundError,ValueError) as error:
                report['unsupported'].append({'kind':kind,'id':identifier,'reason':str(error)})
    for identifier in args.potion:
        try:
            image,proof=renderer.potion(identifier)
            path=output/f'potion-{identifier}.webp';image.save(path,lossless=True)
            report['renders'].append({'kind':'potion','id':identifier,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'colorProof':proof})
        except (UnsupportedAsset,KeyError,FileNotFoundError,ValueError) as error:
            report['unsupported'].append({'kind':'potion','id':identifier,'reason':str(error)})
    (output/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'rendered':len(report['renders']),'unsupported':len(report['unsupported']),'report':str(output/'render-report.json')}))

if __name__=='__main__':
    main()
