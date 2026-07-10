-- CreateTable
CREATE TABLE "ClientNoteImage" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNoteImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientNoteImage_noteId_sortOrder_idx" ON "ClientNoteImage"("noteId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ClientNoteImage" ADD CONSTRAINT "ClientNoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClientNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
