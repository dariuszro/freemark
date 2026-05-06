export function getChangedLines(base: string, current: string): number[] {
  const baseLines = base.split(/\r?\n/);
  const currentLines = current.split(/\r?\n/);
  const cellCount = (baseLines.length + 1) * (currentLines.length + 1);

  if (cellCount > 4_000_000) {
    return getContiguousChangedLines(baseLines, currentLines);
  }

  return getLcsChangedLines(baseLines, currentLines);
}

function getLcsChangedLines(baseLines: string[], currentLines: string[]) {
  const changedLines: number[] = [];
  const width = currentLines.length + 1;
  const lcs = new Uint32Array((baseLines.length + 1) * width);

  for (let baseIndex = baseLines.length - 1; baseIndex >= 0; baseIndex -= 1) {
    for (let currentIndex = currentLines.length - 1; currentIndex >= 0; currentIndex -= 1) {
      const cellIndex = baseIndex * width + currentIndex;

      if (baseLines[baseIndex] === currentLines[currentIndex]) {
        lcs[cellIndex] = lcs[(baseIndex + 1) * width + currentIndex + 1] + 1;
      } else {
        lcs[cellIndex] = Math.max(
          lcs[(baseIndex + 1) * width + currentIndex],
          lcs[baseIndex * width + currentIndex + 1]
        );
      }
    }
  }

  let baseIndex = 0;
  let currentIndex = 0;

  while (baseIndex < baseLines.length && currentIndex < currentLines.length) {
    if (baseLines[baseIndex] === currentLines[currentIndex]) {
      baseIndex += 1;
      currentIndex += 1;
    } else if (
      lcs[(baseIndex + 1) * width + currentIndex] >=
      lcs[baseIndex * width + currentIndex + 1]
    ) {
      const markerLine = Math.min(currentIndex + 1, currentLines.length);
      if (markerLine > 0 && changedLines[changedLines.length - 1] !== markerLine) {
        changedLines.push(markerLine);
      }
      baseIndex += 1;
    } else {
      changedLines.push(currentIndex + 1);
      currentIndex += 1;
    }
  }

  while (currentIndex < currentLines.length) {
    changedLines.push(currentIndex + 1);
    currentIndex += 1;
  }

  return [...new Set(changedLines)];
}

function getContiguousChangedLines(baseLines: string[], currentLines: string[]) {
  let prefixLength = 0;
  while (
    prefixLength < baseLines.length &&
    prefixLength < currentLines.length &&
    baseLines[prefixLength] === currentLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength + prefixLength < baseLines.length &&
    suffixLength + prefixLength < currentLines.length &&
    baseLines[baseLines.length - 1 - suffixLength] ===
      currentLines[currentLines.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const changedLines: number[] = [];
  const changedEnd = currentLines.length - suffixLength;

  for (let index = prefixLength; index < changedEnd; index += 1) {
    if (index >= 0) {
      changedLines.push(index + 1);
    }
  }

  return changedLines;
}
