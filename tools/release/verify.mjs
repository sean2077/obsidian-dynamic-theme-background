import { verifyRelease } from "./contract.mjs";

const usage = "Usage: npm run release:verify -- <version>";
const args = process.argv.slice(2);

if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    process.stdout.write(`${usage}\n`);
} else if (args.length !== 1) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
} else {
    try {
        verifyRelease(process.cwd(), args[0]);
        process.stdout.write(`Verified release ${args[0]}.\n`);
    } catch (error) {
        process.stderr.write(`release:verify: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
