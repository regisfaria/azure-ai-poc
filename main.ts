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
  const imageUrls = [
    "https://s7g10.scene7.com/is/image/knauf/IMG-20210117-WA0009",
    "https://s7g10.scene7.com/is/image/knauf/IMG-20210113-WA0008",
    "https://s7g10.scene7.com/is/image/knauf/IMG-20210113-WA0004",
    "https://s7g10.scene7.com/is/image/knauf/energy-efficiency-more-comfort-2",
    "https://s7g10.scene7.com/is/image/knauf/Knauf-Insulated-Branded-for-Carters",
    "https://s7g10.scene7.com/is/image/knauf/New-Homes",
    "https://s7g10.scene7.com/is/image/knauf/retusche_rotkalk_in_fuellmoertel_tectem_25kg_10spr_540x340_rev02_20200918_pers",
    "https://s7g10.scene7.com/is/image/knauf/cleaneo-single_Bellini",
    "https://s7g10.scene7.com/is/image/knauf/_EBR6798",
    "https://s7g10.scene7.com/is/image/knauf/Stahlblechwand-1",
    "https://s7g10.scene7.com/is/image/knauf/c8f4a014fa24c3fb",
    "https://s7g10.scene7.com/is/image/knauf/VP_Raumklima_2",
    "https://s7g10.scene7.com/is/image/knauf/3c6f1eeb99488ba6",
    "https://s7g10.scene7.com/is/image/knauf/ID_129035",
    "https://s7g10.scene7.com/is/image/knauf/GKA50WT_Aufsicht",
    "https://s7g10.scene7.com/is/image/knauf/statik",
    "https://s7g10.scene7.com/is/image/knauf/ID_290554_MPI_05",
    "https://s7g10.scene7.com/is/image/knauf/ID_149828_BASEL05_02-1",
    "https://s7g10.scene7.com/is/image/knauf/Fotolia_111788606_Subscription_XXL",
    "https://s7g10.scene7.com/is/image/knauf/ee274afa82ef5211",
    "https://s7g10.scene7.com/is/image/knauf/heizkosten-senken",
    "https://s7g10.scene7.com/is/image/knauf/kn01831",
    "https://s7g10.scene7.com/is/image/knauf/Knauf-Wuerzburg_Alte_Maelzerei_Estrich_FE-Fire_6",
    "https://s7g10.scene7.com/is/image/knauf/Knauf-Grundschule-Muenchen-Infanteriestr-VHF-Aquapanel%20%283%29",
    "https://s7g10.scene7.com/is/image/knauf/Stadtschloss-Berlin-Kuppeldecke%20%284%29",
  ];

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
