import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { authError, validateEmail, validateNewPassword } from '../config/auth.js';
import { escapeRegex } from '../utils/helpers.js';

const ALLOWED_ROLES = ['Administrator', 'Instructor', 'Student'];
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const MAX_NAME_LENGTH = 100;

const userDto = (user) => ({
  id: user._id.toString(),
  _id: user._id.toString(),
  fullName: user.fullName,
  name: user.fullName,
  email: user.email,
  role: user.role,
  isActive: Boolean(user.isActive),
  status: user.isActive ? 'Active' : 'Inactive',
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt || null,
});

function duplicateEmailError(cause) {
  const err = authError(
    409,
    'ACCOUNT_EXISTS',
    'A user account with this email already exists.',
    { email: 'This email is already in use. Enter a different email address.' },
  );
  if (cause) err.cause = cause;
  return err;
}

function validateUserData(body, { requirePassword = false } = {}) {
  const fields = {};
  const rawName = body?.fullName !== undefined ? body.fullName : body?.name;
  const fullName = typeof rawName === 'string' ? rawName.trim() : '';
  if (!fullName) {
    fields.name = 'Enter a full name.';
  } else if (fullName.length > MAX_NAME_LENGTH) {
    fields.name = `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  const rawEmail = body?.email;
  const trimmedEmail = typeof rawEmail === 'string' ? rawEmail.trim() : '';
  if (!trimmedEmail) {
    fields.email = 'Enter an email address.';
  } else if (!validateEmail(trimmedEmail)) {
    fields.email = 'Enter a valid email address, such as name@example.edu.';
  }
  const email = trimmedEmail.toLowerCase();

  const role = body?.role;
  if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
    fields.role = 'Select a valid role.';
  }

  let password;
  let mustChangePassword = true;
  if (requirePassword) {
    const rawPassword = body?.password;
    const rawConfirm = body?.confirmPassword;
    if (typeof rawPassword !== 'string' || !rawPassword) {
      fields.password = 'Enter an initial password.';
    } else if (!rawPassword.trim()) {
      fields.password = 'Initial password cannot consist only of spaces.';
    } else if (!validateNewPassword(rawPassword)) {
      fields.password = 'Use at least 8 characters and 72 UTF-8 bytes or fewer.';
    } else {
      password = rawPassword;
    }

    if (typeof rawConfirm !== 'string' || !rawConfirm) {
      fields.confirmPassword = 'Confirm the initial password.';
    } else if (typeof rawPassword === 'string' && rawPassword !== rawConfirm) {
      fields.confirmPassword = 'Passwords do not match.';
    }

    if (body?.mustChangePassword !== undefined) {
      if (typeof body.mustChangePassword !== 'boolean') {
        fields.mustChangePassword = 'Invalid password change requirement flag.';
      } else {
        mustChangePassword = body.mustChangePassword;
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw authError(400, 'VALIDATION', 'Please check the entered user information.', fields);
  }

  return { fullName, email, role, password, mustChangePassword };
}

function parseTargetStatus(body) {
  const hasIsActive = body && Object.hasOwn(body, 'isActive') && body.isActive !== undefined;
  const hasStatus = body && Object.hasOwn(body, 'status') && body.status !== undefined;
  if (!hasIsActive && !hasStatus) {
    throw authError(400, 'VALIDATION', 'Please specify a valid account status.');
  }
  if (hasIsActive && typeof body.isActive !== 'boolean') {
    throw authError(400, 'VALIDATION', 'Invalid account active flag.');
  }
  if (hasStatus && (typeof body.status !== 'string' || !['Active', 'Inactive'].includes(body.status))) {
    throw authError(400, 'VALIDATION', 'Status must be Active or Inactive.');
  }
  if (hasIsActive && hasStatus && body.isActive !== (body.status === 'Active')) {
    throw authError(400, 'VALIDATION', 'Conflicting account status values provided.');
  }
  return hasIsActive ? body.isActive : body.status === 'Active';
}

export async function getUsers(req, res) {
  const { q = '', role, status, page = '1', limit = '100' } = req.query;
  const validRole = role === undefined || role === '' || (typeof role === 'string' && ALLOWED_ROLES.includes(role));
  const validStatus = status === undefined || status === '' || (typeof status === 'string' && ['Active', 'Inactive'].includes(status));
  const pageStr = typeof page === 'string' || typeof page === 'number' ? String(page) : '';
  const limitStr = typeof limit === 'string' || typeof limit === 'number' ? String(limit) : '';
  const pageNum = /^\d+$/.test(pageStr) ? Number(pageStr) : 0;
  const limitNum = /^\d+$/.test(limitStr) ? Number(limitStr) : 0;

  if (
    typeof q !== 'string' ||
    q.length > 254 ||
    !validRole ||
    !validStatus ||
    pageNum < 1 ||
    pageNum > 100000 ||
    limitNum < 1 ||
    limitNum > 100
  ) {
    throw authError(400, 'VALIDATION', 'Invalid user directory filter parameters.');
  }

  const trimmedQuery = q.trim();
  const filter = {
    ...(role ? { role } : {}),
    ...(status ? { isActive: status === 'Active' } : {}),
    ...(trimmedQuery
      ? {
          $or: [
            { fullName: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
            { email: { $regex: escapeRegex(trimmedQuery), $options: 'i' } },
          ],
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    User.find(filter)
      .select('fullName email role isActive mustChangePassword createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    users: records.map(userDto),
    pagination: { page: pageNum, limit: limitNum, total },
  });
}

export async function getUser(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid user ID.');
  }
  const record = await User.findById(req.params.id)
    .select('fullName email role isActive mustChangePassword createdAt')
    .lean();
  if (!record) {
    throw authError(404, 'NOT_FOUND', 'User account not found.');
  }
  res.json({
    status: 'success',
    user: userDto(record),
  });
}

export async function addUser(req, res) {
  const { fullName, email, role, password, mustChangePassword } = validateUserData(req.body, {
    requirePassword: true,
  });

  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) {
    throw duplicateEmailError();
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let created;
  try {
    created = await User.create({
      fullName,
      email,
      role,
      passwordHash,
      isActive: true,
      mustChangePassword,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw duplicateEmailError(error);
    }
    throw error;
  }

  res.status(201).json({
    status: 'success',
    user: userDto(created),
    message: 'User account created successfully.',
  });
}

export async function updateUser(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid user ID.');
  }
  const { fullName, email, role } = validateUserData(req.body, { requirePassword: false });

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const existing = await User.findById(req.params.id).session(session);
    if (!existing) {
      throw authError(404, 'NOT_FOUND', 'User account not found.');
    }

    if (existing._id.equals(req.user._id) && role !== 'Administrator') {
      throw authError(409, 'SELF_ROLE_CHANGE', 'You cannot change your own Administrator role.');
    }

    if (existing.role === 'Administrator' && existing.isActive && role !== 'Administrator') {
      const remainingAdmins = await User.countDocuments({
        role: 'Administrator',
        isActive: true,
        _id: { $ne: existing._id },
      }).session(session);
      if (remainingAdmins === 0) {
        throw authError(
          409,
          'LAST_ADMIN',
          'At least one active Administrator account must remain in the system.',
        );
      }
    }

    if (email !== existing.email) {
      const duplicate = await User.findOne({ email, _id: { $ne: existing._id } })
        .select('_id')
        .session(session)
        .lean();
      if (duplicate) {
        throw duplicateEmailError();
      }
    }

    existing.fullName = fullName;
    existing.email = email;
    existing.role = role;
    try {
      updated = await existing.save({ session });
    } catch (error) {
      if (error?.code === 11000) {
        throw duplicateEmailError(error);
      }
      throw error;
    }
  });

  res.json({
    status: 'success',
    user: userDto(updated),
    message: 'User account updated successfully.',
  });
}

export async function changeUserStatus(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    throw authError(400, 'VALIDATION', 'Invalid user ID.');
  }
  const nextIsActive = parseTargetStatus(req.body);

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const existing = await User.findById(req.params.id).session(session);
    if (!existing) {
      throw authError(404, 'NOT_FOUND', 'User account not found.');
    }

    if (!nextIsActive && existing._id.equals(req.user._id)) {
      throw authError(409, 'SELF_DEACTIVATE', 'You cannot deactivate your own account.');
    }

    if (!nextIsActive && existing.role === 'Administrator' && existing.isActive) {
      const remainingAdmins = await User.countDocuments({
        role: 'Administrator',
        isActive: true,
        _id: { $ne: existing._id },
      }).session(session);
      if (remainingAdmins === 0) {
        throw authError(409, 'LAST_ADMIN', 'Cannot deactivate the last active Administrator account.');
      }
    }

    existing.isActive = nextIsActive;
    updated = await existing.save({ session });
    if (!nextIsActive) {
      await AuthSession.deleteMany({ userId: existing._id }).session(session);
    }
  });

  res.json({
    status: 'success',
    user: userDto(updated),
    message: nextIsActive ? 'User account activated successfully.' : 'User account deactivated successfully.',
  });
}
