import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";

import micromatch from "micromatch";

rmDir("lists");

for(let owner of fs.readdirSync("track")) {
	let ownerDirPath = `track/${owner}`;
	for(let repoDotTxt of fs.readdirSync(ownerDirPath)) {
		let text = fs.readFileSync(`${ownerDirPath}/${repoDotTxt}`, "utf-8");
		let lines = text.replaceAll("\r", "").split("\n");
		let repo = path.parse(repoDotTxt).name;
		
		rmDir(repo);
		await exec(`git clone https://github.com/${owner}/${repo}`);
		process.chdir(repo);
		await exec(`git checkout ${lines.shift()}`);
		let tags = lines.filter(line => line && !line.startsWith("+") && !line.startsWith("-"));
		let globMatches = lines.filter(line => line.startsWith("+")).map(line => line.slice(1).trim());
		let globNegations = lines.filter(line => line.startsWith("-")).map(line => line.slice(1).trim());
		for(let i = 0; i < tags.length - 1; i++) {
			let changedFiles = await exec(`git diff --no-renames --name-only ${tags[i]} ${tags[i + 1]}`, true);
			if(globMatches.length || globNegations.length) {
				changedFiles = changedFiles.split("\n").filter(filepath => globMatches.some(glob => micromatch.isMatch(filepath, glob)) && !globNegations.some(glob => micromatch.isMatch(filepath, glob))).join("\n");
			}
			writeFile(`../lists/${owner}/${repo}/${tags[i]}_to_${tags[i + 1]}.txt`, changedFiles);
		}
		
		process.chdir("../");
		rmDir(repo);
	}
}

function rmDir(dir: string): void {
	if(fs.existsSync(dir)) {
		fs.rmSync(dir, {
			recursive: true
		});
	}
}
function writeFile(filepath: string, content: string): void {
	fs.mkdirSync(path.dirname(filepath), {
		recursive: true
	});
	fs.writeFileSync(filepath, content);
}

function exec(code: string, returnOutput? : false): Promise<number | null>;
function exec(code: string, returnOutput: true): Promise<string>;
function exec(code: string, returnOutput: boolean = false): Promise<number | null | string> {
	console.log("EXECUTING:", code)
	if(returnOutput) {
		return new Promise(res => {
			child_process.exec(code, (err, stdout, stderr) => {
				res(err? stderr : stdout);
			});
		});
	} else {
		let childProcess = child_process.exec(code);
		childProcess.stdout?.pipe(process.stdout);
		childProcess.stderr?.pipe(process.stderr);
		return new Promise(res => {
			childProcess.on("exit", res);
		});
	}
}