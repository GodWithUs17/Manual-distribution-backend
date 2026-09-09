/*
  Warnings:

  - A unique constraint covering the columns `[title,courseCode]` on the table `Manual` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Manual_title_courseCode_key" ON "Manual"("title", "courseCode");
