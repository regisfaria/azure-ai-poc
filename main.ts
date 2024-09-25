import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import axios from "axios";
import fs from "fs";
import util from "util";
import { writeFile, appendFile } from "fs/promises";

// Replace with your own values
const blobStorageAccountName = "---";
const blobStorageAccountKey = "---";
const containerName = "----";
const blobName = "----";
const apiKey = "----";
const endpoint = "----";

interface AzureAIResponse {
  description: string;
  faceCount: number;
  tags: string[];
}

/**
 * Generate a SAS token for a specific blob in Azure Blob Storage
 */
async function generateBlobSasUrl() {
  const sharedKeyCredential = new StorageSharedKeyCredential(
    blobStorageAccountName,
    blobStorageAccountKey
  );

  const blobServiceClient = new BlobServiceClient(
    `https://${blobStorageAccountName}.blob.core.windows.net`,
    sharedKeyCredential
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const sasOptions = {
    containerName: containerName,
    blobName: blobName,
    permissions: BlobSASPermissions.parse("r"), // Read permission
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();
  const sasUrl = `${blobClient.url}?${sasToken}`;

  return sasUrl;
}

/**
 * Call Azure Computer Vision API to get a description of the image
 * @param {string} imageUrl The URL of the image (SAS URL from blob storage)
 */
async function analyzeImage(
  imageUrl: string
): Promise<AzureAIResponse | undefined> {
  try {
    const response = await axios.post(
      `${endpoint}/vision/v3.1/analyze?visualFeatures=Description,Faces,Tags`,
      {
        url: imageUrl,
      },
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const description =
      response.data.description.captions[0]?.text || "No description available";

    const faces = response.data.faces;
    const faceCount = faces.length;

    const tags = response.data.tags.map((tag: { name: string }) => tag.name);

    return {
      description,
      faceCount,
      tags,
    };
  } catch (error) {
    console.error("Error analyzing the image:", error);
  }
}

/**
 * Sleep for a specified duration (in milliseconds)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Write image descriptions to a .txt file
 * @param {string} filePath Path to the file
 * @param {string} content The content to be written
 */
async function writeToFile(filePath: string, content: string): Promise<void> {
  try {
    await appendFile(filePath, content);
  } catch (error) {
    console.error("Error writing to file:", error);
  }
}

// Use case: generate SAS URL from a blob image, then analyze the image description
// (async () => {
//   try {
//     const sasUrl = await generateBlobSasUrl();
//     await analyzeImage(sasUrl);
//     await analyzeImage(
//       "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTtJeVeQTEzjHesp1a1LKjeudvkXHqfMEZoKA&s"
//     );
//   } catch (error) {
//     console.error("Error in main flow:", error);
//   }
// })();

// Use case: From a list of images url, generate their description. Store the result as .txt file
(async () => {
  // List of public image URLs
  const imageUrls = [];

  const filePath = "./image_descriptions.txt";

  await writeFile(filePath, "");

  for (const imageUrl of imageUrls) {
    const result = await analyzeImage(imageUrl);

    if (!result) continue;

    const { description, faceCount, tags } = result;
    const hasHumanFaceOnImage = faceCount > 0;

    const fileContent = `imageURL: ${imageUrl}\nsuggestedDescription: ${description}\nhasHumanFaceOnImage: ${hasHumanFaceOnImage}\nnumberOfFacesDetected: ${faceCount}\nsuggestedKeywords: [${tags.join(
      ", "
    )}]\n\n`;

    await writeToFile(filePath, fileContent);

    // Random delay between 1 to 2 seconds (1000ms to 2000ms)
    const randomDelay = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
    await sleep(randomDelay);
  }
})();
