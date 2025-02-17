const express = require("express");
const cors = require("cors");
const simpleGit = require("simple-git");
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");

const GITHUB_TOKEN = ""
const GITHUB_USERNAME = "BeNikk";

const app = express();
app.use(cors());
app.use(express.json());

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.post("/init", async (req, res) => {
    const { repoName, fileContent } = req.body;
    
    if (!repoName || !fileContent) {
        return res.status(400).json({ message: "Repo name and file content are required" });
    }

    try {
        const response = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: false,  
        });

        const repoUrl = response.data.clone_url;
        console.log("GitHub repo created:", repoUrl);

        const repoPath = path.join(__dirname, repoName);
        if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath);

        const git = simpleGit(repoPath);

        await git.init();
        fs.writeFileSync(path.join(repoPath, "README.md"), fileContent);
        await git.add(".");
        await git.commit("Initial commit");

        await git.addRemote("origin", repoUrl);
        await git.branch(["-M", "main"]);
        await git.push("origin", "main");

        res.json({ message: `Repository '${repoName}' created and pushed successfully!`, repoUrl });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Failed to create repository", error: error.message });
    }
});

app.post("/fork", async (req, res) => {
    try {
        const { repoUrl } = req.body;

        const urlParts = repoUrl.split("/");
        const owner = urlParts[urlParts.length - 2];
        const repo = urlParts[urlParts.length - 1];

        const forkResponse = await octokit.repos.createFork({
            owner,
            repo
        });

        res.json({ 
            message: `Repository forked successfully!`, 
            forkedRepoUrl: forkResponse.data.html_url 
        });
    } catch (error) {
        console.error("Forking failed:", error);
        res.status(500).json({ message: "Forking failed", error: error.message });
    }
});
app.get("/readme", async (req, res) => {
    try {
        const { repoUrl } = req.query;

        const urlParts = repoUrl.split("/");
        const owner = urlParts[urlParts.length - 2];
        const repo = urlParts[urlParts.length - 1];

        const readmeResponse = await octokit.repos.getReadme({
            owner,
            repo,
            mediaType: { format: "raw" }
        });

        res.json({ readmeContent: readmeResponse.data });
    } catch (error) {
        console.error("Fetching README failed:", error);
        res.status(500).json({ message: "Failed to fetch README", error: error.message });
    }
});

const git = simpleGit();

app.post("/clone", async (req, res) => {
    try {
        const { repoUrl, repoName } = req.body;

        await git.clone(repoUrl, `./repos/${repoName}`);

        res.json({ message: `Repository cloned successfully: ${repoName}` });
    } catch (error) {
        console.error("Cloning failed:", error);
        res.status(500).json({ message: "Cloning failed", error: error.message });
    }
});

app.post("/edit", async (req, res) => {
    try {
        const { repoName, content } = req.body;
        const filePath = `./repos/${repoName}/README.md`;

        fs.writeFileSync(filePath, content, "utf8");

        await git.cwd(`./repos/${repoName}`)
                 .add("./README.md")
                 .commit("Updated README file");

        res.json({ message: "README updated & committed successfully!" });
    } catch (error) {
        console.error("Editing failed:", error);
        res.status(500).json({ message: "Editing failed", error: error.message });
    }
});
app.post("/push", async (req, res) => {
    try {
        const { repoName, githubUsername, accessToken } = req.body;
        const remoteUrl = `https://${githubUsername}:${accessToken}@github.com/${githubUsername}/${repoName}.git`;

        await git.cwd(`./repos/${repoName}`)
                 .push(remoteUrl, "main");

        res.json({ message: "Changes pushed to GitHub!" });
    } catch (error) {
        console.error("Push failed:", error);
        res.status(500).json({ message: "Push failed", error: error.message });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));