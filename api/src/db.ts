import { PrismaClient } from "@prisma/client";

// Jeden współdzielony klient Prisma na cały proces.
export const prisma = new PrismaClient();
