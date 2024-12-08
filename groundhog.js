const { chromium } = require("playwright");
const readline = require("readline");

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to ask for the groundhog name
const askForGroundhogName = () => {
  return new Promise((resolve) => {
    rl.question("\nEnter the groundhog’s name: ", (groundhogName) => {
      resolve(groundhogName);
    });
  });
};

// Function to ask for the year
const askForYear = (validPredictions, groundhogName) => {
  return new Promise((resolve) => {
    console.log("\nYears with Predictions:");
    validPredictions.forEach((item, index) => {
      console.log(`${index + 1}. Year: ${item.year}`);
    });

    rl.question(
      `Enter a year to see ${groundhogName}’s prediction: `,
      (inputYear) => {
        const selectedPrediction = validPredictions.find(
          (item) => item.year === inputYear
        );

        if (selectedPrediction) {
          resolve({
            year: inputYear,
            prediction: selectedPrediction.prediction,
          });
        } else {
          console.log(
            "Invalid year entered or no prediction available for that year. Please try again."
          );
          resolve(null);
        }
      }
    );
  });
};

// Main async function
(async () => {
  // Create a browser instance
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the website
  await page.goto("https://groundhog-day.com");

  // Click "Groundhogs" in the navigation menu
  await page.click('nav div.nav--md ul li:has-text("Groundhogs")');

  // Wait for the groundhogs page to load
  await page.waitForSelector("input[type='search']");

  let foundSingleResult = false;
  let groundhogName = "";

  // Keep searching until we have a single result
  while (!foundSingleResult) {
    // Ask user for the groundhog's name
    groundhogName = await askForGroundhogName();

    // Clear the previous search input
    await page.fill("input.search", "");

    // Use the locator to type in the name
    const locator = page.getByLabel("Find groundhogs by name:");
    await locator.pressSequentially(groundhogName, { delay: 50 });

    // Allow time for the results to update
    console.log("Waiting for search results to update...");
    await page.waitForTimeout(250); // Adjust timeout as needed

    // Check the number of rows in the table
    const rows = await page.$$eval("table tbody tr", (rows) =>
      rows.map((row) => {
        const nameCell = row.querySelector("th");
        return nameCell ? nameCell.textContent.trim() : "";
      })
    );

    if (rows.length === 1) {
      // If there's exactly one result, proceed
      foundSingleResult = true;
      console.log(`Found: ${rows[0]}`);
      await page.click("table tbody tr");
    } else if (rows.length > 1) {
      // If there's more than one result, list them and ask the user to refine their search
      console.log("\nMultiple results found:");
      rows.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
      });
      console.log("Please narrow down your results to one groundhog.");
    } else {
      // No results found, prompt the user to try again
      console.log("No results found. Please try again.");
    }
  }

  // Wait for the predictions table to load
  console.log(`Navigating to ${groundhogName}’s page...`);
  await page.waitForSelector("table tbody");
  groundhogName = await page.$eval("h1", (element) =>
    element.textContent.trim()
  );

  // Extract all rows from the predictions table
  const rows = await page.$$eval("table tbody tr", (rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      return cells.map((cell) => cell.textContent.trim());
    })
  );

  // Filter out rows without predictions and list valid years
  const validPredictions = rows
    .filter(
      (row) => row.length > 1 && !row[row.length - 1].includes("No prediction")
    )
    .map((row) => ({
      year: row[0],
      prediction: row[row.length - 1],
    }));

  // Keep asking for a year until we get a valid one
  let selectedYear;
  while (!selectedYear) {
    selectedYear = await askForYear(validPredictions, groundhogName);
  }

  // Print the prediction for the selected year
  console.log(
    `\n${groundhogName}’s prediction for ${selectedYear.year} is: ${selectedYear.prediction}`
  );

  // Close the readline interface and browser
  rl.close();
  await browser.close();
})();
