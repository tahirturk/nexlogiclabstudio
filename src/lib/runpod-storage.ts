import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const OWNER_COOKIE = "runpod_history_owner";
const OUTPUT_RETENTION_MS = 12 * 60 * 60 * 1000;
const REFERENCE_RETENTION_MS = 12 * 60 * 60 * 1000;
const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

export type RequestOwner = { id: string; isNew: boolean };

export type StoredJob = {
  id: string;
  ownerId: string;
  runpodJobId: string;
  title: string;
  voice: string;
  createdAt: number;
  completedAt?: number;
  expiresAt: number;
  status: string;
  error?: string;
  referenceId?: string;
};

type StoredReference = {
  id: string;
  ownerId: string;
  tokenHash: string;
  contentType: string;
  expiresAt: number;
};

function storageRoot() {
  const configured = process.env.RUNPOD_STORAGE_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".runpod-data");
}

function ownerDirectory(ownerId: string) {
  return path.join(storageRoot(), "users", ownerId);
}

function jobsDirectory(ownerId: string) {
  return path.join(ownerDirectory(ownerId), "jobs");
}

function jobMetadataPath(ownerId: string, jobId: string) {
  return path.join(jobsDirectory(ownerId), `${jobId}.json`);
}

function jobAudioPath(ownerId: string, jobId: string) {
  return path.join(jobsDirectory(ownerId), `${jobId}.wav`);
}

function referencesDirectory() {
  return path.join(storageRoot(), "references");
}

function referenceMetadataPath(referenceId: string) {
  return path.join(referencesDirectory(), `${referenceId}.json`);
}

function referenceAudioPath(referenceId: string) {
  return path.join(referencesDirectory(), `${referenceId}.bin`);
}

function isMissingFile(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function getRequestOwner(request: Request): RequestOwner {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existing = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OWNER_COOKIE}=`))
    ?.slice(OWNER_COOKIE.length + 1);

  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { id: existing, isNew: false };
  }

  return { id: randomUUID(), isNew: true };
}

export function withOwnerCookie(response: Response, owner: RequestOwner) {
  if (!owner.isNew) return response;

  const headers = new Headers(response.headers);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append(
    "Set-Cookie",
    `${OWNER_COOKIE}=${owner.id}; Path=/api/runpod; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function newId() {
  return randomUUID();
}

export function validStoredId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function newReferenceToken() {
  return randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, filePath);
}

export async function saveReference(
  ownerId: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const id = newId();
  const token = newReferenceToken();
  const record: StoredReference = {
    id,
    ownerId,
    tokenHash: tokenDigest(token),
    contentType,
    expiresAt: Date.now() + REFERENCE_RETENTION_MS,
  };
  await mkdir(referencesDirectory(), { recursive: true });
  await writeFile(referenceAudioPath(id), bytes, { mode: 0o600 });
  await writeJsonAtomic(referenceMetadataPath(id), record);
  return { id, token, expiresAt: record.expiresAt };
}

export async function readReference(id: string, token: string) {
  if (!validStoredId(id) || !/^[0-9a-f]{64}$/i.test(token)) return null;

  let record: StoredReference;
  try {
    record = JSON.parse(
      await readFile(referenceMetadataPath(id), "utf8"),
    ) as StoredReference;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  if (record.expiresAt <= Date.now()) {
    await removeReference(id);
    return null;
  }
  if (!secureEqual(record.tokenHash, tokenDigest(token))) return null;

  try {
    const [bytes, fileStats] = await Promise.all([
      readFile(referenceAudioPath(id)),
      stat(referenceAudioPath(id)),
    ]);
    return { bytes, contentType: record.contentType, size: fileStats.size };
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export async function removeReference(referenceId: string) {
  await Promise.all([
    rm(referenceAudioPath(referenceId), { force: true }),
    rm(referenceMetadataPath(referenceId), { force: true }),
  ]);
}

export async function saveJob(job: StoredJob) {
  await writeJsonAtomic(jobMetadataPath(job.ownerId, job.id), job);
}

export async function readJob(ownerId: string, jobId: string) {
  if (!validStoredId(ownerId) || !validStoredId(jobId)) return null;
  try {
    const job = JSON.parse(
      await readFile(jobMetadataPath(ownerId, jobId), "utf8"),
    ) as StoredJob;
    return job.ownerId === ownerId && job.id === jobId ? job : null;
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export async function readJobAudio(ownerId: string, jobId: string) {
  if (!validStoredId(ownerId) || !validStoredId(jobId)) return null;
  const job = await readJob(ownerId, jobId);
  if (!job || job.expiresAt <= Date.now() || job.status !== "COMPLETED") {
    return null;
  }

  try {
    return await readFile(jobAudioPath(ownerId, jobId));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export async function removeJob(ownerId: string, jobId: string) {
  if (!validStoredId(ownerId) || !validStoredId(jobId)) return;
  await Promise.all([
    rm(jobMetadataPath(ownerId, jobId), { force: true }),
    rm(jobAudioPath(ownerId, jobId), { force: true }),
  ]);
}

export async function listOwnerJobs(ownerId: string) {
  if (!validStoredId(ownerId)) return [];
  const directory = jobsDirectory(ownerId);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }

  const jobs: StoredJob[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -5);
    if (!validStoredId(id)) continue;
    const job = await readJob(ownerId, id);
    if (!job) continue;
    if (job.expiresAt <= Date.now()) {
      await removeJob(ownerId, id);
      if (job.referenceId) await removeReference(job.referenceId);
      continue;
    }
    if (job.status === "COMPLETED") jobs.push(job);
  }
  return jobs.sort((left, right) => right.createdAt - left.createdAt);
}

export async function cleanupRunpodStorage() {
  const root = storageRoot();
  const now = Date.now();
  let removed = 0;

  const usersRoot = path.join(root, "users");
  try {
    for (const ownerId of await readdir(usersRoot)) {
      if (!validStoredId(ownerId)) continue;
      const directory = jobsDirectory(ownerId);
      let names: string[];
      try {
        names = await readdir(directory);
      } catch {
        continue;
      }
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        const jobId = name.slice(0, -5);
        const job = await readJob(ownerId, jobId);
        if (job && job.expiresAt <= now) {
          await removeJob(ownerId, jobId);
          if (job.referenceId) await removeReference(job.referenceId);
          removed += 1;
        }
      }
    }
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  try {
    for (const name of await readdir(referencesDirectory())) {
      if (!name.endsWith(".json")) continue;
      const referenceId = name.slice(0, -5);
      if (!validStoredId(referenceId)) continue;
      try {
        const record = JSON.parse(
          await readFile(referenceMetadataPath(referenceId), "utf8"),
        ) as StoredReference;
        if (record.expiresAt <= now) {
          await removeReference(referenceId);
          removed += 1;
        }
      } catch {
        await removeReference(referenceId);
      }
    }
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  return removed;
}

export async function writeJobAudio(
  ownerId: string,
  jobId: string,
  bytes: Uint8Array,
) {
  const filePath = jobAudioPath(ownerId, jobId);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, filePath);
}

export function outputExpiry(completedAt: number) {
  return completedAt + OUTPUT_RETENTION_MS;
}

export function jobExpiry(createdAt: number) {
  return createdAt + JOB_RETENTION_MS;
}

export async function readLimitedBody(response: Response, limit: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error("Generated audio exceeds the 100 MB storage limit.");
  }

  if (!response.body) throw new Error("Runpod returned an empty audio file.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Generated audio exceeds the 100 MB storage limit.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
