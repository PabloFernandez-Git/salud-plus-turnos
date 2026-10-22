export function analyzeRobotsMetaContents(contents) {
  const directives = contents.flatMap((content) =>
    typeof content === "string"
      ? content
          .split(",")
          .map((directive) => directive.trim().toLowerCase())
          .filter(Boolean)
      : [],
  );
  return {
    hasNoindex: directives.includes("noindex"),
    hasIndexConflict: directives.includes("index") || directives.includes("all"),
  };
}
