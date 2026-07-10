-- CreateTable
CREATE TABLE "ClientNoteLike" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNoteLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientNoteLike_noteId_idx" ON "ClientNoteLike"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientNoteLike_noteId_barberId_key" ON "ClientNoteLike"("noteId", "barberId");

-- AddForeignKey
ALTER TABLE "ClientNoteLike" ADD CONSTRAINT "ClientNoteLike_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClientNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNoteLike" ADD CONSTRAINT "ClientNoteLike_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
