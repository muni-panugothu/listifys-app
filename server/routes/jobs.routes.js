const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware.js");
const upload = require("../middleware/upload.middleware.js");
const { optimiseImages } = require("../middleware/upload.middleware.js");
const {
  postingLimiter,
  uploadLimiter,
  saveLimiter,
  searchLimiter,
} = require("../middleware/ratelimiter.middleware.js");
const {
  cacheResponseTracked,
  invalidateAfter,
} = require("../middleware/cache.middleware.js");
const { validateListingInput } = require("../middleware/validation.middleware.js");
const { validateCreateJob, validateUpdateJob, validateJobQuery } = require("../validations/jobs.validation.js");
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getSavedJobs,
  uploadImages,
  toggleSave,
} = require("../controllers/jobs.controller.js");

router.get("/", searchLimiter, cacheResponseTracked("jobs", 300, "list"), getAllJobs);

router.get("/my-listings", protect, getMyJobs);
router.get("/saved", protect, getSavedJobs);

router.post("/", protect, postingLimiter, validateListingInput, validateCreateJob, invalidateAfter("jobs"), createJob);

router.post(
  "/upload-images",
  protect,
  uploadLimiter,
  upload.array("images", 6),
  optimiseImages,
  uploadImages
);

router.get("/:id", searchLimiter, cacheResponseTracked("jobs", 300, "detail"), getJobById);
router.put("/:id", protect, postingLimiter, validateListingInput, validateUpdateJob, invalidateAfter("jobs"), updateJob);
router.delete("/:id", protect, invalidateAfter("jobs"), deleteJob);
router.post("/:id/toggle-save", protect, saveLimiter, toggleSave);

module.exports = router;
