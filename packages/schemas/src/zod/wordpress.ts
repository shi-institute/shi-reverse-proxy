import { z } from 'zod';

export const wpDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  .or(z.string().datetime())
  .describe('WordPress datetime');

export const wordpressProjectSchema = z.object({
  id: z.number(),
  date: wpDate,
  date_gmt: wpDate,
  modified: wpDate,
  modified_gmt: wpDate,
  slug: z.string(),
  status: z.string(),
  type: z.literal('projects'),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  content: z.object({
    rendered: z.string(),
    protected: z.boolean(),
  }),
  excerpt: z.object({
    rendered: z.string(),
    protected: z.boolean(),
  }),
  author: z.number(),
  featured_media: z.number(),
  template: z.string(),
  meta: z.record(z.string(), z.unknown()),
  'project-category': z.array(z.number()),
  'project-tag': z.array(z.number()),
  _links: z.record(z.string(), z.unknown()),
});

export const wordpressMediaSchema = z.object({
  id: z.number(),
  date: wpDate,
  date_gmt: wpDate,
  modified: wpDate,
  modified_gmt: wpDate,
  slug: z.string(),
  type: z.literal('attachment'),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  author: z.number(),
  comment_status: z.string(),
  ping_status: z.string(),
  alt_text: z.string(),
  caption: z.object({ rendered: z.string() }),
  description: z.object({ rendered: z.string() }),
  media_type: z.string(),
  mime_type: z.string(),
  post: z.number().nullable(),
  source_url: z.string().url(),
  media_details: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    file: z.string().optional(),
    filesize: z.number().optional(),
    sizes: z
      .record(
        z.string(),
        z.object({
          file: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          mime_type: z.string().optional(),
          source_url: z.url().optional(),
        })
      )
      .optional(),
    image_meta: z
      .object({
        aperture: z.number().or(z.string()).optional(),
        credit: z.string().optional(),
        camera: z.string().optional(),
        caption: z.string().optional(),
        created_timestamp: z.string().optional(),
        copyright: z.string().optional(),
        focal_length: z.number().or(z.string()).optional(),
        iso: z.number().or(z.string()).optional(),
        shutter_speed: z.number().or(z.string()).optional(),
        title: z.string().optional(),
        orientation: z.string().optional(),
        keywords: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  _links: z.record(z.string(), z.unknown()),
});

export type MediaDetails = z.infer<typeof wordpressMediaSchema>['media_details'];
type ProjectBrief = z.infer<typeof wordpressProjectSchema> & { media?: z.infer<typeof wordpressMediaSchema> | null };
export type ProjectBriefs = ProjectBrief[];
