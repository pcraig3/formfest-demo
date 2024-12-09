const { chromium } = require("playwright");
const readline = require("readline");
const OpenAI = require("openai");

require("dotenv").config();

const data = require("./data.json");

const domain = "https://vreg.registertovoteon.ca/en/home";

/* UTILITY FUNCS */

// Function to clean JSON string
const cleanJSONString = (jsonString) => {
  return jsonString.replace(/^```json|^```|```$/g, "").trim();
};

const getDataPrompt = (key) => {
  if (data && data[key]) {
    return `> [${data[key]}] `;
  }

  return "> ";
};

const typeEffect = async (text, minDelay = 15, maxDelay = 40) => {
  process.stdout.write("\n"); // Newline beforehand
  for (const char of text) {
    process.stdout.write(char);
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  process.stdout.write("\n"); // Move to the next line after finishing the text
};

const getCompletion = async ({ query, prompt }) => {
  const openai = new OpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant designed to output JSON.",
      },
      {
        role: "system",
        content: prompt,
      },
      { role: "user", content: query },
    ],
    response_format: { type: "json_object" },
  });

  return completion.choices[0].message.content;
};

/* GET ANSWERS */

// Function to prompt user and get agreement
const getAgreement = async () => {
  await typeEffect("🤖: Is that okay with you?");

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("> ", (answer) => {
      rl.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      if (normalizedAnswer === "yes" || normalizedAnswer === "y") {
        resolve(true);
      } else if (normalizedAnswer === "no" || normalizedAnswer === "n") {
        resolve(false);
      } else {
        console.log("🤖: Invalid response. Please enter yes/y or no/n.");
        resolve(getAgreement()); // Recursively prompt until valid input
      }
    });
  });
};

// Function to ask user to confirm closing the browser
const confirmClose = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Type 'yes' or 'y' to close the browser: ", (answer) => {
      rl.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      if (normalizedAnswer === "yes" || normalizedAnswer === "y") {
        resolve(true);
      } else {
        console.log("🤖: Browser will remain open.");
        resolve(false);
      }
    });
  });
};

// Function to prompt user for their full name
const getFullName = async () => {
  while (true) {
    await typeEffect("🤖: What’s your full name?");

    let fullName = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(getDataPrompt("fullName"), (fullName) => {
        rl.close();
        resolve(fullName.trim());
      });
    });

    if (!fullName.trim() && data && data["fullName"]) {
      fullName = data["fullName"];
    }

    if (fullName.split(" ").length > 1) {
      // Make an OpenAI API call to break the name into first, middle, and last
      let message = await getCompletion({
        query: `Full name: ${fullName}`,
        prompt:
          "Given a full name, return a JSON response with the fields 'first_name', 'middle_name', 'last_name'. Example 1: Full name: Paul Craig => {first_name: Paul, middle_name: '', last_name: Craig}, Example 2: Full name: Paul Martin Craig => {first_name: Paul, middle_name: Martin, last_name: Craig}, Example3: Full name: Craig => {first_name: Craig, middle_name: '', last_name: ''}, Example4: Full name: Paul Martin Laurier Craig => {first_name: Paul, middle_name: Martin Laurier, last_name: Craig}",
      });

      const name = JSON.parse(cleanJSONString(message));

      if (name.first_name && name.last_name) {
        return name;
      }
    } else {
      await typeEffect(
        "🤖: Please make sure you enter a first and last name (eg, Gabrielle Roy)"
      );
    }
  }
};

// Function to prompt user for their birthday
const getBirthday = async () => {
  while (true) {
    await typeEffect("🤖: Your date of birth?");

    let birthday = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(getDataPrompt("birthday"), (birthday) => {
        rl.close();
        resolve(birthday.trim());
      });
    });

    if (!birthday.trim() && data && data["birthday"]) {
      birthday = data.birthday;
    }

    // Make an OpenAI API call to parse the date
    let message = await getCompletion({
      query: `Date: ${birthday}`,
      prompt:
        "Given a date, return a JSON response with the fields 'day', 'month', 'year'. Note that 'month' should always be the complete month name. Example 1: Date: October 8, 1990 => {day: 8, month: October, year: 1990}, Example 2: Date: 8 Oct 1990 => {day: 8, month: Oct, year: 1990}, Example3: Date: 1990-02-02 => {day: 2, month: February, year: 1990}, Example4: Date: 1990/2/1 => {day: 2, month: February, year: 1990}, Example5: Dec 10 90 => {day: 10, month: December, year: 1990}, Example5: Feb 29 => {day: 29, month: Feb, year: ''}, Example6: 1990 => {day: '', month: '', year: 1990}, Example6: Feb 31, 1990 => {day: '', month: February, year: 1990}",
    });
    const date = JSON.parse(cleanJSONString(message));

    if (date.day && date.month && date.year) {
      return date;
    } else {
      await typeEffect(
        "🤖: Please enter a valid date including day, month, and year (eg, Jan 1 1980)"
      );
    }
  }
};

// Function to prompt user for postal code with validation
const getPostalCode = async () => {
  while (true) {
    await typeEffect("🤖: Your postal code?");

    let postalCode = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(getDataPrompt("postalCode"), (postalCode) => {
        rl.close();
        resolve(postalCode.replace(/\s+/g, "")); // Remove whitespace
      });
    });

    if (!postalCode.trim() && data && data["postalCode"]) {
      postalCode = data.postalCode;
    }

    // Validate postal code format (e.g., A1A1A1)
    const postalCodeRegex = /^[A-Z]\d[A-Z]\d[A-Z]\d$/i;
    if (postalCode.length === 6 && postalCodeRegex.test(postalCode)) {
      return postalCode.toUpperCase();
    } else {
      await typeEffect(
        "🤖: Oops, invalid postal code format. Please enter a valid postal code (eg, A1A 1A1)."
      );
    }
  }
};

// Function to ask user if the street name is correct
const isStreetCorrect = async (streetName) => {
  await typeEffect(`🤖: Is "${streetName}" the street you live on?`);
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("> ", (answer) => {
      rl.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      if (normalizedAnswer === "yes" || normalizedAnswer === "y") {
        resolve(true);
      } else if (normalizedAnswer === "no" || normalizedAnswer === "n") {
        resolve(false);
      } else {
        console.log("🤖: Please enter yes/y or no/n.");
        resolve(isStreetCorrect(streetName)); // Recursively prompt until valid input
      }
    });
  });
};

// Function to prompt user for their street and apartment numbers
const getStreetAndApartmentNumbers = async () => {
  await typeEffect("🤖: Your street (and unit number, if applicable)?");

  while (true) {
    let address = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(getDataPrompt("address"), (address) => {
        rl.close();
        resolve(address.trim());
      });
    });

    if (!address.trim() && data && data["address"]) {
      address = data.address;
    }

    if (address.split(" ").length > 1) {
      // Make an OpenAI API call to parse the street and apartment numbers
      let message = await getCompletion({
        query: `Address: ${address}`,
        prompt:
          "Given a street address with optional unit/apartment number, return a JSON response with the fields 'street_number', 'unit_number'. Example 1: Address: 2-180 Lisgar St => {street_number: 180, unit_number: 2}, Example 2: Address: 2166 Jenner Court => {street_number: 2166, unit_number: ''}, Example 3: Address: 180 Lisgar St Apartment 12 => {street_number: 180, unit_number: 12}, Example 4: Address: 1800 lisgar unit 3 => {street_number: 1800, unit_number: 3}, Example 5: Address: 18 Lisgar Street Ottawa Ontario => {street_number: 18, unit_number: ''},  Example 6: Address: Jenner Court => {street_number: '', unit_number: ''}, Example 6: Address: 180 => {street_number: 180, unit_number: ''}",
      });
      const name = JSON.parse(cleanJSONString(message));

      if (name.street_number) {
        return name;
      } else {
        console.log(
          "🤖: Sorry, I didn’t get that. Could you try again? (eg, 123 Front Street, Apt 3)"
        );
      }
    } else {
      console.log(
        "🤖: Please enter your street name and number (eg, 123 Front Street, Apt 3)."
      );
    }
  }
};

// Function to fill out a field based on label
const fillFieldByLabel = async (
  page,
  labelText,
  value,
  xpath = "xpath=following-sibling::input"
) => {
  const labelLocator = page.locator(`label:has-text("${labelText}")`);
  const inputLocator = labelLocator.locator(xpath);
  await inputLocator.scrollIntoViewIfNeeded();
  await inputLocator.pressSequentially(`${value}`, { delay: 100 });
};

// Function to select an option from a dropdown based on label
const selectOptionByLabel = async (page, labelText, optionText) => {
  const labelLocator = page.locator(`label:has-text("${labelText}")`);
  const divLocator = labelLocator.locator("xpath=following-sibling::div");
  const selectLocator = divLocator.locator("select");
  await selectLocator.scrollIntoViewIfNeeded();
  await selectLocator.selectOption({ label: optionText });
};

const getUserInput = (promptText) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

(async () => {
  // Simulated conversation
  await typeEffect("🤖: Hey there! How can I assist you today? 😊");
  await getUserInput("> ");

  await typeEffect("🤖: Great! Is there something I can help with?");
  await getUserInput(">: ");

  await typeEffect("🤖: Sure, I'll do my best");

  // Typing dots to simulate thinking
  await typeEffect("🤖: .......", 100, 500);
  process.stdout.write("\n");

  await typeEffect(
    "🤖: Okay, I've found the voter registration form for Ontario at https://vreg.registertovoteon.ca/en/home"
  );

  // Create a browser instance
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Set default timeout to 60 seconds
  page.setDefaultTimeout(60000);

  // Navigate to the registration website
  await page.goto(domain);

  /******************************************
   *              LANDING PAGE              *
   ******************************************/

  // Look for the button that says "Get started" and click it
  await page.click('button:has-text("Get started")');

  /******************************************
   *               DISCLAIMER               *
   ******************************************/

  // Wait for the new page to load and look for the h2 "before you start"
  await page.waitForSelector('h2:has-text("before you start")');

  // Print the important information on the command line
  await typeEffect("🤖: Let’s check if you are registered to vote!");
  await typeEffect(
    "🤖: You will need to enter your:\n\t- name\n\t- birthday\n\t- current address"
  );

  // Get user agreement
  const userAgreed = await getAgreement();

  if (!userAgreed) {
    await typeEffect("🤖: User did not agree to continue.");
    // Close the browser
    await browser.close();
  }

  // Click the "Next" button
  await page.click('button:has-text("Next")');

  /******************************************
   *             PERSONAL INFO              *
   ******************************************/

  // Wait for the new page to load and look for the h2 "Citizenship"
  await page.waitForSelector('h2:has-text("Citizenship")');

  // Citizenship question - click "yes" after "I am a Canadian citizen"
  const citizenshipQuestionLocator = page.locator(
    'label:has-text("I am a Canadian citizen.")'
  );
  await citizenshipQuestionLocator.scrollIntoViewIfNeeded();
  await page.locator('input[aria-label="Yes I am a Canadian citizen"]').click();

  // Living in Ontario question - click the label "Currently living in Ontario"
  const ontarioLabelLocator = page.locator(
    'label:has-text("Currently living in Ontario")'
  );
  await ontarioLabelLocator.scrollIntoViewIfNeeded();
  await ontarioLabelLocator.click();

  // Get user's full name
  const name = await getFullName();

  // Fill out first name field using label function
  await fillFieldByLabel(page, "First name", name.first_name);

  // Fill out middle name field using label function
  if (name.middle_name) {
    await fillFieldByLabel(page, "Middle name", name.middle_name);
  }

  // Fill out last name field using label function
  await fillFieldByLabel(page, "Last name", name.last_name);

  // Get user's birthday
  const date = await getBirthday();

  // Select month field using label function
  await selectOptionByLabel(page, "Month", date.month);

  // Fill out last name field using label function
  await fillFieldByLabel(page, "Day", date.day);

  // Fill out last name field using label function
  await fillFieldByLabel(page, "Year", date.year);

  // Click the "Next" button
  await page.click('button:has-text("Next")');

  /******************************************
   *             ADDRESS INFO               *
   ******************************************/

  // Wait for the new page to load and look for the h2 "Address information"
  await page.waitForSelector('h2:has-text("Address information")');

  // Get user's postal code
  const postalCode = await getPostalCode();

  // Fill out postal code field
  await fillFieldByLabel(
    page,
    "Postal code",
    postalCode,
    "xpath=following-sibling::app-postal-code//input"
  );

  // Wait for street selection dropdown to appear
  await page.waitForSelector('select[id="selectedStreet"]', { timeout: 5000 });

  // Grab the name of the first street mentioned
  const streetName = await page.$eval(
    'select[id="selectedStreet"] option:nth-child(2)',
    (option) => option.textContent.trim()
  );

  // Ask user if the street name is correct
  const isStreetConfirmed = await isStreetCorrect(streetName);

  if (isStreetConfirmed) {
    // Select the correct street
    await page.selectOption('select[id="selectedStreet"]', { index: 1 });
  } else {
    await typeEffect("🤖: Sorry, probably you aren’t registered then.");
    // Close the browser
    await browser.close();
    return;
  }

  const address_numbers = await getStreetAndApartmentNumbers();
  await fillFieldByLabel(page, "Street number", address_numbers.street_number);
  if (address_numbers.unit_number) {
    await fillFieldByLabel(page, "Unit number", address_numbers.unit_number);
  }

  // Click the "Search" button
  await page.click('button:has-text("Search")');

  /******************************************
   *               FOUND PAGE               *
   ******************************************/

  // Wait for the new page to load and determine if user is found
  const foundSelector =
    'h2:has-text("We found you on the Register with the information provided.")';
  const notFoundSelector =
    'h2:has-text("We could not find you with the information provided.")';
  await page.waitForSelector(`${foundSelector}, ${notFoundSelector}`);

  const foundHeaderText = await page.textContent(
    `${foundSelector}, ${notFoundSelector}`
  );

  if (
    foundHeaderText.includes(
      "We found you on the Register with the information provided."
    )
  ) {
    await typeEffect("🤖: Looks like you’re all set!");
    // Click the "Confirm" button
    await page.click('button:has-text("Confirm")');
  } else {
    await typeEffect(
      "🤖: Sorry, I couldn't find you in the registry.\n\nVisit https://vreg.registertovoteon.ca/en/home to check on your own.\n\nOr, try again!"
    );

    // Ask user to confirm closing the browser
    const userConfirmedClose = await confirmClose();
    if (userConfirmedClose) {
      // Close the browser
      await browser.close();
    }
    return;
  }
  /******************************************
   *            CONFIRMATION PAGE           *
   ******************************************/

  await page.waitForSelector(
    'h2:has-text("Thank you for confirming your information.")'
  );

  // Extract the information from the list
  const homeAddressInfo = await page.$eval(
    'section[aria-labelledby="home-address-header"] ul',
    (ul) => {
      const data = {};
      const items = ul.querySelectorAll("li");
      items.forEach((item) => {
        const label = item.querySelector("label").textContent.trim();
        const valueElement = item.querySelector("b, a");
        const value = valueElement ? valueElement.textContent.trim() : null;
        if (label.includes("Electoral district")) {
          data.electoralDistrict = value;
          if (valueElement.tagName === "A") {
            data.electoralDistrictLink = valueElement.href;
          }
        } else if (label.includes("Municipality")) {
          data.municipality = value;
        }
      });
      return data;
    }
  );

  await typeEffect(
    `🤖: Your voter registration info:\n\t- Municipality: ${homeAddressInfo.municipality}\n\t- Electoral District: ${homeAddressInfo.electoralDistrict}\n\t- Link: ${homeAddressInfo.electoralDistrictLink}\n`
  );

  // Ask user to confirm closing the browser
  const userConfirmedClose = await confirmClose();
  if (userConfirmedClose) {
    // Close the browser
    await browser.close();
  }
})();
