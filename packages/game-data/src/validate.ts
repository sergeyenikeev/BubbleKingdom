import { chapters, contentValidationErrors, contentVersion, levels } from "./index";

if (contentValidationErrors.length > 0) {
  console.error("Bubble Kingdom content validation failed:");
  for (const error of contentValidationErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Bubble Kingdom content ${contentVersion} validated: ${levels.length} levels across ${chapters.length} chapters.`,
);
