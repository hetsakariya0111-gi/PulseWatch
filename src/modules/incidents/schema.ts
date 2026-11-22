import { z } from "zod";

import { IncidentStatus } from "@/generated/prisma/enums";

export const incidentUpdateSchema = z.object({
  message: z.string().trim().min(1, "Update message is required").max(1000),
  status: z.enum([
    IncidentStatus.INVESTIGATING,
    IncidentStatus.IDENTIFIED,
    IncidentStatus.MONITORING,
    IncidentStatus.RESOLVED,
  ]),
});

export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
