import { z } from 'zod';
const text = z.string().trim().min(1).refine(v => !v.includes('—'), 'Em dashes are not allowed');
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const reportSchema = z.object({
  contract: z.literal('stats-report@1'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  slug: id,
  title: text,
  meta_description: text,
  dek: text,
  short_version: z.array(text).min(3).max(5),
  markers: z.array(z.object({
    date: z.iso.date(),
    label: text
  }).strict()),
  rating_labels: z.array(z.number().int().positive()).optional(),
  chart_titles: z.record(z.string(), text).optional(),
  body: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('h2'),
      id,
      text
    }).strict(), z.object({
      type: z.literal('p'),
      md: text
    }).strict(), z.object({
      type: z.literal('chart'),
      id
    }).strict(), z.object({
      type: z.literal('dates'),
      rows: z.array(z.object({
        date: z.iso.date(),
        md: text
      }).strict())
    }).strict()
  ]))
}).strict();
export type StatsReport = z.infer<typeof reportSchema>;
export const reportJsonSchema = z.toJSONSchema(reportSchema);
