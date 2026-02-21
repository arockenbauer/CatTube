import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.js';
import { validate, searchSchema } from '../utils/validators.js';
import * as searchCtrl from '../controllers/searchController.js';

const router = Router();

router.get('/', optionalAuth, validate(searchSchema), searchCtrl.search);
router.get('/suggestions', searchCtrl.getSuggestions);

export default router;
