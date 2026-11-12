export function handleBack(stack) {
  return stack.length > 1 ? "pop" : "exit";
}
