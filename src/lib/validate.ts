import { z } from "zod";

export const staffNo = z
  .string()
  .trim()
  .min(2, "at least 2 characters")
  .max(40)
  .regex(/^[A-Za-z0-9._\-/]+$/, "use letters, numbers, dot, dash or slash only");
export const fullName = z.string().trim().min(2, "at least 2 characters").max(120);
export const password = z.string().min(8, "at least 8 characters").max(200);
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
export const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v ?? "");
export const zoneFields = {
  name: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(20, "at least 20 m").max(5000, "at most 5 km"),
  active: z.boolean(),
  /** A drawn area's corners as [lat, lng]; null for a circle. */
  polygon: z
    .array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
    .min(3, "draw at least 3 corners")
    .max(100, "use at most 100 corners")
    .nullable(),
};

export const scheduleFields = {
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9-]+$/, "letters, numbers and dash only"),
  start_time: hm,
  end_time: hm,
  grace_minutes: z.number().int().min(0).max(120),
  work_days: z.array(z.number().int().min(1).max(7)).min(1, "pick at least one day").max(7),
};

export const idParam = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new z.ZodError([{ code: "custom", path: ["id"], message: "invalid id", input: v }]);
  return n;
};
