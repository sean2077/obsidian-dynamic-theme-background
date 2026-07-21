import { prepareRelease } from "./contract.mjs";

const usage = "Usage: npm run release:prepare -- <version>";
const args = process.argv.slice(2);

if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    process.stdout.write(`${usage}\n`);
} else if (args.length !== 1) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
} else {
    try {
        const paths = prepareRelease(process.cwd(), args[0]);
        process.stdout.write(`Prepared ${args[0]} in ${paths.length} version files.\n`);
    } catch (error) {
        process.stderr.write(`release:prepare: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
