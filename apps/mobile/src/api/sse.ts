export interface SseFrame {
  event: string;
  data: string;
}

export function splitSseFrames(buffer: string): {
  frames: SseFrame[];
  rest: string;
} {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  const frames: SseFrame[] = [];

  for (const chunk of chunks) {
    let event = "message";
    const dataLines: string[] = [];

    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).replace(/^ /, ""));
      }
    }

    if (dataLines.length > 0) {
      frames.push({ event, data: dataLines.join("\n") });
    }
  }

  return { frames, rest };
}
