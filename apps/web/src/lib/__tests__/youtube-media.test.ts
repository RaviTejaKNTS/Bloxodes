import { describe, expect, it } from "vitest";
import { extractYouTubeVideoUrlId } from "../youtube-media";

const id = "QdBZY2fkU-0";

describe("collection YouTube URLs", () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}&t=5`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=share`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ])("accepts an official URL format: %s", (url) => {
    expect(extractYouTubeVideoUrlId(url)).toBe(id);
  });

  it.each([
    id, null, {}, `http://www.youtube.com/watch?v=${id}`,
    `javascript:https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`,
    `https://evil.test@youtube.com/watch?v=${id}`,
    `https://youtube.com:8443/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/other?v=${id}`,
    `https://youtube.com/path/embed/${id}`,
    `https://youtube.com/embed/${id}/extra`,
    `https://youtu.be/${id}/extra`,
    `https://www.youtube.com/watch?v=${id}&v=VQRLujxTm3c`,
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${id}%3Cscript%3E`,
    "https://www.youtube.com/watch?v=1234567890.",
  ])("rejects an unsupported or unsafe value: %s", (url) => {
    expect(extractYouTubeVideoUrlId(url)).toBeNull();
  });
});
