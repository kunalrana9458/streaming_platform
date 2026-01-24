import { Request, Response } from "express";
import { success, z } from "zod";
import {
  createTitle,
  getAllTitles,
  getTitleById,
  updateTitle,
  deleteTitle,
} from "./catalog.service";
import { release } from "os";

export const createTitleController = async (req: any, res: Response) => {
  try {
    const schema = z.object({
      type: z.enum(["movie", "series"]),
      name: z.string().min(1),
      description: z.string().optional(),
      language: z.string().min(1),
      isLive: z.boolean().optional(),
      genres: z.array(z.string()).optional(),
      releaseYear: z.number().optional(),
      thumbnailUrl: z.string().optional(),
    });

    const body = schema.parse(req.body);
    req.log.info('Catalog cration started')
    const title = await createTitle(body,req.log);
    return res.status(201).json({ message: "Title created", title });
  } catch (err: any) {
    req.log.info('Error in the Catalog creation');
    return res
      .status(400)
      .json({ error: { code: "CREATE_FAILED", message: err.message } });
  }
};

export const getAllTitlesController = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    req.log.info('Fetching all Catalog from the DB')
    const data = await getAllTitles(page, limit,req.log);
    return res.json(data);
  } catch (err) {
    req.log.info('Error while fetching the Catalog')
    return res
      .status(400)
      .json({
        error: { code: "FETCH_FAILED", message: "Cannot fetch titles" },
      });
  }
};

export const getTitleByIdController = async (req: Request, res: Response) => {
  try {
    req.log.info('Fetch catalog by Id');
    const title = await getTitleById(req.params.id);
    if (!title) {
      req.log.warn('Title Not Found in the DB');
      return res.status(404).json({ error: { code: "NOT_FOUND" } });
    }
    req.log.info('Catalog fetched Successfully By ID');
    return res.json(title);
  } catch (err) {
    return res
      .status(400)
      .json({ error: { code: "FETCH_FAILED", message: "Invalid ID" } });
  }
};

export const updateTitleController = async (req: any, res: Response) => {
  try {
    if(!req.params.id) {
      req.log.info('Catalog ID not found for updation');
      return res.status(400).json({
        success: false,
        message: 'Catalog ID not found'
      });
    }
    req.log.info({catalogId:req.params.id},'Catalog Updation Started');
    const updated = await updateTitle(req.params.id, req.body);
    req.log.info('Catalog Updated Successfully')
    return res.json({ message: "Title updated", updated });
  } catch (err) {
    req.log.error('Error in the catalog updation')
    return res.status(400).json({ error: { code: "UPDATE_FAILED" } });
  }
};

export const deleteTitleController = async (req: any, res: Response) => {
  try {
    if(!req.params.id){
      req.log.info('CatalogID not found for deletion');
      return res.status(400).json({
        success: false,
        message: 'Catalog ID not found for deletion'
      })
    }
    await deleteTitle(req.params.id);
    req.log.info('Catalog deleted Successfully');
    return res.json({ message: "Title deleted" });
  } catch (err) {
    return res.status(400).json({ error: { code: "DELETE_FAILED" } });
  }
};
