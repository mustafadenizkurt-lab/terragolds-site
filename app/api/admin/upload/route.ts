import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../lib/admin-auth";
import { getMediaBucket } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

function hasValidMagicBytes(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Bir görsel seçin." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return Response.json(
      { error: "Yalnızca JPG, JPEG, PNG veya WebP görsel yükleyebilirsiniz." },
      { status: 400 },
    );
  }
  const sourceExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(sourceExtension)) {
    return Response.json(
      { error: "Dosya uzantısı JPG, JPEG, PNG veya WebP olmalıdır." },
      { status: 400 },
    );
  }
  const extensionMatchesMime =
    (file.type === "image/jpeg" &&
      (sourceExtension === "jpg" || sourceExtension === "jpeg")) ||
    (file.type === "image/png" && sourceExtension === "png") ||
    (file.type === "image/webp" && sourceExtension === "webp");
  if (!extensionMatchesMime) {
    return Response.json(
      { error: "Dosya uzantısı ile MIME türü birbiriyle uyuşmuyor." },
      { status: 400 },
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "Görsel en fazla 5 MB olabilir." },
      { status: 400 },
    );
  }
  const headerBytes = new Uint8Array(
    await file.slice(0, 12).arrayBuffer(),
  );
  if (!hasValidMagicBytes(file.type, headerBytes)) {
    return Response.json(
      { error: "Dosyanın gerçek içeriği seçilen görsel türüyle uyuşmuyor." },
      { status: 400 },
    );
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const key = `products/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await getMediaBucket().put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name.slice(0, 120) },
  });

  return Response.json({
    key,
    url: `/api/media/${key}`,
  });
}
