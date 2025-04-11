// Import necessary modules using ES module syntax
import { writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import dirTree from 'directory-tree';

// Determine the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Set the directory path to the parent directory of 'src'
const directoryPath = __dirname; // This points to your project's root directory

// Function to extract relative paths from the directory tree
const extractPaths = (node, basePath, paths = []) => {
  const relativePath = relative(basePath, node.path);
  paths.push(relativePath);
  if (node.children) {
    node.children.forEach(child => extractPaths(child, basePath, paths));
  }
  return paths;
};

// Generate the directory tree, excluding 'node_modules' and '.git' directories
const tree = dirTree(directoryPath, {
  exclude: /node_modules|\.git/
});

// Extract relative paths
const relativePaths = extractPaths(tree, directoryPath);

// Output the result to a JSON file
writeFileSync('directoryStructure.json', JSON.stringify(relativePaths, null, 2));

console.log('Directory structure has been saved to directoryStructure.json');

// run it - node generateTree.js
