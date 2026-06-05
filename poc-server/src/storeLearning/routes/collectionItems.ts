import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';

type CollectionItemRoutesOptions = {
  connection: DbConnection;
};

const SelectionPatchSchema = z.object({
  selected: z.boolean(),
  selectionReason: z.string().trim().min(1).nullable().optional()
});

function nowIso() {
  return new Date().toISOString();
}

export function createCollectionItemRoutes({ connection }: CollectionItemRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.patch('/:itemId/selection', (req, res, next) => {
    try {
      const item = repos.collectionItems.findById(req.params.itemId);
      if (!item) {
        res.status(404).json({ error: `Collection item not found: ${req.params.itemId}` });
        return;
      }

      const body = SelectionPatchSchema.parse(req.body);
      const collectionItem = repos.collectionItems.update(item.id, {
        selectedForAnalysis: body.selected ? 1 : 0,
        selectionReason: body.selectionReason ?? (body.selected ? 'selected_for_analysis' : 'excluded_from_analysis'),
        selectedAt: nowIso()
      });

      res.json({ collectionItem });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
