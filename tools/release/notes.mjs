import { writeReleaseNotes } from "./contract.mjs";

const usage = "Usage: npm run release:notes -- <version> <output-file>";
const args = process.argv.slice(2);

if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    process.stdout.write(`${usage}\n`);
} else if (args.length !== 2) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
} else {
    try {
        writeReleaseNotes(process.cwd(), args[0], args[1]);
        process.stdout.write(`Wrote release notes for ${args[0]} to ${args[1]}.\n`);
    } catch (error) {
        process.stderr.write(`release:notes: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
