import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional()
});

export const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().optional(),
  bannerUrl: z.string().optional()
});

export const videoUploadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.string().optional(),
  category: z.string().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional()
});

export const videoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  tags: z.string().optional(),
  category: z.string().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional()
});

export const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.number().int().positive().optional()
});

export const reportSchema = z.object({
  reason: z.string().min(1).max(100),
  details: z.string().max(1000).optional()
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  sort: z.enum(['relevance', 'date', 'views', 'duration']).optional(),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  type: z.enum(['video', 'short', 'channel']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export const resetPasswordSchema = z.object({
  email: z.string().email()
});

export const newPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128)
});

export function validate(schema) {
  return (req, res, next) => {
    const target = req.method === 'GET' ? req.query : req.body;
    const result = schema.safeParse(target);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      });
    }
    req.validated = result.data;
    next();
  };
}
