ALTER TABLE "Photographer"
ADD COLUMN "inquiryGoalTarget" INTEGER;

ALTER TABLE "Photographer"
ADD CONSTRAINT "Photographer_inquiryGoalTarget_positive"
CHECK ("inquiryGoalTarget" IS NULL OR "inquiryGoalTarget" > 0);
