export type LyricField = HTMLTextAreaElement | HTMLDivElement;

export function fieldText(field: LyricField): string {
  return field instanceof HTMLTextAreaElement
    ? field.value
    : (field.textContent ?? "");
}

export function fieldSelection(field: LyricField) {
  if (field instanceof HTMLTextAreaElement)
    return {
      start: field.selectionStart,
      end: field.selectionEnd,
      backward: field.selectionDirection === "backward",
    };
  const selection = document.getSelection();
  if (
    !selection?.anchorNode ||
    !selection.focusNode ||
    !field.contains(selection.anchorNode) ||
    !field.contains(selection.focusNode)
  )
    return { start: 0, end: 0, backward: false };
  const offset = (node: Node, index: number) => {
    const range = document.createRange();
    range.selectNodeContents(field);
    range.setEnd(node, index);
    return range.toString().length;
  };
  const anchor = offset(selection.anchorNode, selection.anchorOffset);
  const focus = offset(selection.focusNode, selection.focusOffset);
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
    backward: anchor > focus,
  };
}

export function selectField(
  field: LyricField,
  start: number,
  end: number,
  backward = false,
) {
  if (field instanceof HTMLTextAreaElement) {
    field.setSelectionRange(start, end, backward ? "backward" : "forward");
    return;
  }
  const point = (offset: number): [Node, number] => {
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0;
      if (offset <= length) return [node, offset];
      offset -= length;
    }
    return [field, field.childNodes.length];
  };
  const anchor = point(backward ? end : start);
  const focus = point(backward ? start : end);
  document.getSelection()?.setBaseAndExtent(...anchor, ...focus);
}

export function paintLyricField(field: HTMLDivElement, text: string) {
  const fragment = document.createDocumentFragment();
  for (const run of text.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) ?? []) {
    if (/^\p{Script=Han}/u.test(run)) {
      const span = document.createElement("span");
      span.className = "editor-han";
      span.textContent = run;
      fragment.append(span);
    } else fragment.append(run);
  }
  field.replaceChildren(fragment);
}
