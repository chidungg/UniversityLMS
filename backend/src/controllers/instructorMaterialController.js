import path from "node:path";
import mongoose from "mongoose";
import { authError } from "../config/auth.js";
import Course from "../models/Course.js";
import LearningMaterial from "../models/LearningMaterial.js";
import { escapeRegex } from "../utils/helpers.js";
import { materialExternalUrl, MAX_MATERIAL_FILE_SIZE, removeStoredMaterial, sendMaterialResource } from "../utils/materialStorage.js";
import { requireAssignedCourse } from "./instructorCourseController.js";

const courseFields = "courseCode courseName isActive";
const types = LearningMaterial.schema.path("type").enumValues;

function publicMaterial(material, course) {
  const { _id, title, description, type, fileUrl, fileName, fileSize, uploadedAt } = material;
  return { _id, courseId: course, title, description, type, fileUrl, fileName, fileSize, uploadedAt };
}

export async function getInstructorMaterials(req, res) {
  const { courseId, q = "", type = "all" } = req.query;
  if (typeof q !== "string" || q.length > 200 || (type !== "all" && !types.includes(type))) {
    throw authError(400, "INVALID_MATERIAL_FILTER", "Invalid material search or category.");
  }
  const courses = courseId === undefined
    ? await Course.find({ instructorId: req.user._id }).select(courseFields).lean()
    : [await requireAssignedCourse(courseId, req.user._id, courseFields)];
  const courseById = new Map(courses.map((course) => [String(course._id), course]));
  const filter = { courseId: { $in: courses.map(({ _id }) => _id) } };
  if (type !== "all") filter.type = type;
  if (q.trim()) {
    const term = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ title: term }, { description: term }, { fileName: term }];
    const matchingCourses = courses.filter(({ courseCode }) => term.test(courseCode));
    if (matchingCourses.length) filter.$or.push({ courseId: { $in: matchingCourses.map(({ _id }) => _id) } });
  }

  const materials = await LearningMaterial.find(filter).sort({ uploadedAt: -1, _id: -1 }).lean();
  res.json({ status: "success", data: materials.map((material) => publicMaterial(material, courseById.get(String(material.courseId)))) });
}

async function findAssignedMaterial(materialId, instructorId) {
  if (!mongoose.isObjectIdOrHexString(materialId)) {
    throw authError(400, "INVALID_MATERIAL_ID", "Invalid material ID.");
  }
  const material = await LearningMaterial.findById(materialId).select("+storageKey").lean();
  if (!material) throw authError(404, "MATERIAL_NOT_FOUND", "Learning material not found.");

  const course = await Course.findOne({ _id: material.courseId, instructorId }).select(courseFields).lean();
  if (!course) throw authError(404, "MATERIAL_NOT_FOUND", "Learning material not found.");
  return { course, material };
}

function requireActiveCourse(course) {
  if (course.isActive === false) throw authError(409, "COURSE_INACTIVE", "This course is inactive.");
}

export async function authorizeMaterialCreation(req, _res, next) {
  req.materialCourse = await requireAssignedCourse(req.params.courseId, req.user._id, courseFields);
  requireActiveCourse(req.materialCourse);
  next();
}

export async function authorizeMaterialChange(req, _res, next) {
  const { course, material } = await findAssignedMaterial(req.params.materialId, req.user._id);
  requireActiveCourse(course);
  req.materialCourse = course;
  req.learningMaterial = material;
  next();
}

function materialChanges(req, material) {
  const { title = material.title, description = material.description ?? "", type = material.type, fileUrl = "" } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200 || !types.includes(type)) {
    throw authError(400, "INVALID_MATERIAL", "Enter a title of at most 200 characters and select a valid category.");
  }
  if (typeof description !== "string" || description.trim().length > 5000) {
    throw authError(400, "INVALID_MATERIAL_DESCRIPTION", "Description must be at most 5000 characters.");
  }
  if (typeof fileUrl !== "string" || fileUrl.trim().length > 2048) {
    throw authError(400, "INVALID_MATERIAL_URL", "Enter a valid HTTP or HTTPS resource link.");
  }
  const changes = { title: title.trim(), description: description.trim(), type };
  const link = fileUrl.trim();
  if (req.file) {
    if (req.file.size > MAX_MATERIAL_FILE_SIZE) {
      throw authError(413, "MATERIAL_FILE_TOO_LARGE", "File size exceeds the 50 MB limit.");
    }
    if (link || !req.file.size) throw authError(400, "INVALID_MATERIAL_RESOURCE", "Attach a nonempty file or enter a resource link.");
    const ext = path.extname(req.file.originalname);
    const name = path.basename(req.file.originalname, ext).replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_");
    return {
      ...changes,
      storageKey: req.file.filename,
      fileName: `${Array.from(name).slice(0, 180).join("").trim() || "material"}${ext}`,
      fileSize: req.file.size,
      fileUrl: `/api/student/materials/${material._id}/download`,
    };
  }
  if (link) {
    const externalUrl = materialExternalUrl(link);
    if (!externalUrl) throw authError(400, "INVALID_MATERIAL_URL", "Enter a valid HTTP or HTTPS resource link.");
    return { ...changes, fileUrl: externalUrl, fileName: null, fileSize: null };
  }
  if (!req.learningMaterial) throw authError(400, "MATERIAL_RESOURCE_REQUIRED", "Attach a file or enter a resource link.");
  return changes;
}

async function removeUpload(key) {
  try {
    await removeStoredMaterial(key);
  } catch (error) {
    console.error("Material file cleanup failed:", error.code || error.name);
  }
}

async function saveUpload(req, save) {
  try {
    if (req.file) {
      // Ownership can change while a file is still uploading.
      requireActiveCourse(await requireAssignedCourse(String(req.materialCourse._id), req.user._id, "isActive"));
    }
    return await save();
  } catch (error) {
    if (req.file) {
      try {
        // A database error can arrive after the upload has been referenced by the material.
        if (error.statusCode < 500 || !(await LearningMaterial.exists({ storageKey: req.file.filename }))) {
          await removeUpload(req.file.filename);
        }
      } catch (cleanupError) {
        console.error("Could not verify unused material upload:", cleanupError.code || cleanupError.name);
      }
    }
    throw error;
  }
}

export async function createMaterial(req, res) {
  const material = await saveUpload(req, async () => {
    const document = new LearningMaterial({ courseId: req.materialCourse._id });
    document.set(materialChanges(req, document));
    return document.save();
  });
  res.status(201).json({ status: "success", message: "Learning material uploaded successfully.", data: publicMaterial(material, req.materialCourse) });
}

function currentMaterialFilter({ _id, courseId, __v }) {
  return { _id, courseId, __v: __v ?? { $exists: false } };
}

function verifyMaterialChanged(material) {
  if (!material) throw authError(409, "MATERIAL_CHANGED", "This material changed. Reload the list and try again.");
  return material;
}

export async function updateMaterial(req, res) {
  const original = req.learningMaterial;
  const material = await saveUpload(req, async () => {
    const changes = materialChanges(req, original);
    const replacesFile = changes.fileUrl && !changes.storageKey;
    const updated = verifyMaterialChanged(await LearningMaterial.findOneAndUpdate(
      currentMaterialFilter(original),
      { $set: changes, $inc: { __v: 1 }, ...(replacesFile ? { $unset: { storageKey: 1 } } : {}) },
      { returnDocument: "after", runValidators: true }
    ).lean());
    if (changes.fileUrl) await removeUpload(original.storageKey);
    return updated;
  });
  res.json({ status: "success", message: "Learning material updated successfully.", data: publicMaterial(material, req.materialCourse) });
}

export async function deleteMaterial(req, res) {
  const original = req.learningMaterial;
  verifyMaterialChanged(await LearningMaterial.findOneAndDelete(currentMaterialFilter(original)).lean());
  await removeUpload(original.storageKey);
  res.status(204).end();
}

export async function downloadInstructorMaterial(req, res) {
  const { material } = await findAssignedMaterial(req.params.materialId, req.user._id);
  return sendMaterialResource(material, res);
}
