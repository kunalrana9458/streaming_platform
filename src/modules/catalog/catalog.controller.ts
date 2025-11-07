import { Request, Response } from "express";
import { z } from "zod";
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
      genres: z.array(z.string()).optional(),
      releaseYear: z.number().optional(),
      thumbnailUrl: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const title = await createTitle(body);
    return res.status(201).json({ message: "Title created", title });
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: { code: "CREATE_FAILED", message: err.message } });
  }
};

export const getAllTitlesController = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const data = await getAllTitles(page, limit);
    return res.json(data);
  } catch (err) {
    return res
      .status(400)
      .json({
        error: { code: "FETCH_FAILED", message: "Cannot fetch titles" },
      });
  }
};

export const getTitleByIdController = async (req: Request, res: Response) => {
  try {
    const title = await getTitleById(req.params.id);
    if (!title) return res.status(404).json({ error: { code: "NOT_FOUND" } });
    return res.json(title);
  } catch (err) {
    return res
      .status(400)
      .json({ error: { code: "FETCH_FAILED", message: "Invalid ID" } });
  }
};

export const updateTitleController = async (req: any, res: Response) => {
  try {
    const updated = await updateTitle(req.params.id, req.body);
    return res.json({ message: "Title updated", updated });
  } catch (err) {
    return res.status(400).json({ error: { code: "UPDATE_FAILED" } });
  }
};

export const deleteTitleController = async (req: any, res: Response) => {
  try {
    await deleteTitle(req.params.id);
    return res.json({ message: "Title deleted" });
  } catch (err) {
    return res.status(400).json({ error: { code: "DELETE_FAILED" } });
  }
};
