**WHY - Vision & Purpose**

### **Purpose & Users**

Porfin is helping health professionals in Brazil to have more successful businesses by analyzing their customer journeys and creating automated optimal processes through AI.

## **WHAT - Core Requirements**

### **Functional Requirements**

The system, in Brazilian Portuguese, must allow users to:

- Register themselves with their email address, using password or Google Sign In, and the name of the clinic.

- Connect their WhatsApp Business (one or more accounts) and/or their WhatsApp Business API (one or more). WhatsApp Business has no official API and is the most common app used by healthcare professionals. Users could connect their WhatsApp accounts leveraging open-source projects such as Baileys, available at https://github.com/WhiskeySockets/Baileys.

- Use an interface similar to WhatsApp to communicate with customers, given the connection with the WhatsApp Business. Using this interface, for a given chat, the user could toggle on/off the ability of AI agents to write messages to the customer.

- Monitor key business metrics based on their existing WhatsApp conversations. For example, users should be able to select a time period and see the number of chats, the number of messages, the response rate (% of chats with at least one customer response), appointment rate (% of chats that had an appointment scheduled), medium first time to response, medium time between first contact and appointment for the chats that had an appointment.

- See at what stage customers are in the sales funnel, such as lead, waiting for first appointment, negotiating, under treatment and post-treatment.

- Receive an analysis and recommendations over the time series of each monitored metric. For example, by looking at the chart of average daily chats count, the user should see a description of what is happening at the time series, such as an increase, stability or decrease in the number of chats over time, and a recommendation of increasing marketing investments in case the number of chats were decreasing.

- Through an user-friendly interface, activate pre-configured AI agents that work as virtual assistants powered by GPT-4o. The basic pre-configured virtual assistants should be:

  - Assistente de leads: responsible for converting leads on WhatsApp into first appointments while providing a great customer experience. Ideally, the agent should have access to the calendar appointment system, so the agent would be able to book the evaluation appointments at available windows among the list of available doctors. If the calendar appointment system is not available, the assistant should notify the human secretary through a WhatsApp number that this lead wants to book an appointment, providing an easy way for the secretary to access the chat.

  - Assistente de venda de orçamento: responsible for selling the treatment plan for the customer after the customer is aware of the prices of each treatment. The assistant needs to be skilled at sales and negotiation, and knowledgeable about the products and services offered by the clinic and how they compare with the market and how they can solve the patients needs. This assistant also should have access to a knowledge base of treatment prices, payment plans and discount policies. This assistant might be integrated with payment gateways to charge the customer through PIX, barcode or credit card.

- Personalize their virtual assistants by changing their names, their prompts and providing additional documents for their knowledge base.

- Iterate with their virtual assistants by simulating chats on an interface that simulates WhatsApp, i.e., accepting text messages, recorded audio, images and attached documents such as pdf. Under this simulated environment, the user should be able to change the prompt, provide optional additional context variables (such as customer’s name) and provide optional chat history, so that users can simulate what the assistant would say after a set of messages.

- See a list of created campaigns and their status, such as in-progress, draft, paused or finished. The user should be able to to pause in-progress campaigns, as well as edit and play the campaigns currently paused or in draft.

- Setup communication campaigns that send bulk messages through WhatsApp, spacing each message by a random number between 60 and 120 seconds. Each campaign has a name, a target customer base and a goal. Once the name and goal is defined, the user should receive an LLM suggestion about the jinja template to be used in the campaign. These templates would expect different variables as input, such as the customer_name, clinic_name, doctor_name, etc, depending on the message generated to fulfill the campaign’s goal.

- During the campaign creation process, the user could decide to set up an ad-hoc (campanha única) or recurrent campaign. The user should be able to easily configure the date for sending the ad-hoc campaign, such as today, tomorrow or on a specific date. In case of recurrent campaigns, the user should select a rule that will be used to trigger the campaign message. For example, the sales follow-up rule could look like this:

  - While the customer did not transition to the state of achieved goal, for example accepting the treatment plan price, the AI will try to generate and send a message 0, 1, 3, 6, 10, 14 and 19 days after the campaign began. To generate such a message, the AI will read the chat history, generate the message response and run another check to assure that it makes sense for the customer experience to send this additional message. For example, if the customer said that he/she needs until next week to decide, it does not make sense to follow up until next week.

- Select one or more groups of users during the campaign creation process for targeting purposes, and these groups of users by default are created by the stage these customers are in the sales funnel.

- Review the campaign configuration and test with a test WhatsApp number before activating the campaign in production. Once the campaign is created, the system should play an animation congratulating the user for creating such a campaign.

- For more details about the chatbot flow, see the components below:

1. **User Input:**

   - The user provides input through a multimodal channel (e.g., text, voice).

2. **Input Processing:**

   - The input goes through:

     - **Multimodal to Text:** Converting voice or other inputs into text.

     - **Activation Policy:** Decides whether the system should act based on the input. For example, the activation policy could specify that the model should only reply during non-business hours, or only during business hours because someone could monitor it, or it could be available 24/7. This is a setup that the user needs to configure for each virtual assistant.

   - This step may interact with a **Comms DB** to log or retrieve communication data.

3. **Natural Language Understanding (NLU):**

   - Processes the input to understand:

     - **Intent Recognition:** Determines the user's intention.

     - **Entity Extraction:** Identifies specific details or entities (e.g., names, dates).

   - It may use data from a **CRM** to enhance understanding or personalization.

4. **Dialog Management:**

   - The system decides:

     - **Decide Agent:** Determines which agent or module should handle the input (e.g., Sales, Customer Service).

     - **Decide Response:** Formulates the response, which may be null if no action is needed.

5. **Agents:**

   - Different agents handle specific tasks:

     - **Sales, Customer Service, Billing, Feedback, Human Handoff** (for escalations).

   - These agents may use APIs or predefined instructions to respond.

6. **Docs & APIs:**

   - Supporting documentation and APIs are available for:

     - FAQ, Generic Instructions, Personalized Instructions, as they are the knowledge base of the virtual assistants.

     - Booking, Messaging, Review, Registration, Payments APIs.

7. **Output Processing:**

   - Prepares the response through:

     - **Grammar Check:** Ensures linguistic correctness.

     - **Formatting:** Structures the response appropriately.

     - **Sanity Checks:** Validates the response for accuracy and appropriateness.

8. **Response Delivery:**

   - The final response is delivered if it makes sense to send such a response to the customer. For example, if the customer just replied saying Thanks or Bye, and we had already said Thanks or Bye, it would be repetitive and cause an infinite loop that we don’t want to happen:

     - **Reply at Same Channel:** Sends the response back via the same medium as the input.

   - Interacts with the **Comms DB** to log the response.

- 

The system ideally should be able to:

- Offer Google Calendar integration with an appointment feature in which the AI agents would be able to book appointments through a tool, sending the date, time, appointment duration (60 minutes by default) and the professional_id.

- Integrate with usual CRM solutions in Brazil, such as RD Station and HubSpot.

- Integrate with typical dental clinic CRM solutions in Brazil, such as Clinicorp and EasyDental.

## **HOW - Planning & Implementation**

### **Technical Implementation**

**Required Stack Components**

- Frontend (primarily web app with responsive design in NextJS, tailwindcss for styling and framer motion for animations and UI components using Radix UI, but nice to have mobile version for chats and calendar)

- Backend (Python-based API using FastAPI, integrates with Firebase for authentication, Firestore as the database for messages, Scalable APIs, real-time messaging services, database compatible with Metabase for monitoring)

- Integrations (CRM platforms, Baileys for WhatsApp integration (https://github.com/WhiskeySockets/Baileys), WhatsApp Business API (for advanced users), OpenAI for LLMs, Google Calendar, payment gateways for Brazilian payment infrastructure)

- Infrastructure: Google Cloud

**System Requirements**

- High performance for real-time communication.

- Secure authentication and data handling (e.g., GDPR compliance).

- Scalable to handle increasing user and message volumes.

- Reliable uptime with redundancy and fail-safes.

### **User Experience**

**Key User Flows**

##### **Key User Flows for Virtual Assistants**

1. **Setup and Customization**

   - **Entry Point**: Virtual Assistants Tab → "Create New Assistant" or select an existing assistant.

   - **Key Steps/Interactions**:

     1. Define the assistant’s purpose:

        - Lead Assistant.

        - Sales Assistant.

        - Custom Assistant.

     2. Customize the assistant:

        - Name.

        - Prompt configuration.

        - Knowledge base uploads (e.g., pricing tables, treatment documents).

     3. Review setup and activate the assistant.

   - **Success Criteria**: The assistant is configured and operational for real-world use.

2. **Testing and Iteration**

   - **Entry Point**: Virtual Assistants Tab → Select Assistant → "Test Assistant."

   - **Key Steps/Interactions**:

     1. Enter a simulation environment mimicking WhatsApp.

     2. Test with text messages, audios, or attachments.

     3. Adjust settings or prompts and retest in real-time.

   - **Success Criteria**: The assistant performs well in simulated conditions.

3. **Daily Interaction with Virtual Assistants**

   - **Entry Point**: Chat Interface or Virtual Assistants Tab.

   - **Key Steps/Interactions**:

     1. View active conversations managed by assistants.

     2. Toggle AI intervention on/off for specific chats.

     3. Oversee actions like appointment bookings or treatment negotiations.

     4. Intervene manually if needed.

   - **Success Criteria**: Assistants effectively handle routine tasks with minimal manual input.

4. **Performance Monitoring**

   - **Entry Point**: Virtual Assistants Tab → Analytics.

   - **Key Steps/Interactions**:

     1. View metrics such as conversion rates, satisfaction scores, and performance trends.

     2. Receive system-generated recommendations for optimizing assistants.

   - **Success Criteria**: Users can track, analyze, and improve assistant effectiveness.

##### **Key User Flows for Metrics Monitoring and Campaigns**

1. **Monitoring Metrics**

   - **Entry Point**: Dashboard.

   - **Key Steps**: Select time period → View metrics → Receive AI analysis.

   - **Success Criteria**: Insights are clear, actionable, and accurate.

2. **Campaign Creation**

   - **Entry Point**: Campaigns tab in Dashboard.

   - **Key Steps**: Configure campaign → Review and test → Activate.

   - **Success Criteria**: Campaign sends messages as intended and yields actionable results.

### **Core Interfaces**

1. **Dashboard**

   - Purpose: Centralized monitoring.

   - Key Functionality: Metric display, insights, and recommendations.

2. Virtual Assistant Tab

   - Purpose: Manage and interact with AI assistants.

   - Key Functionality: Assistant setup, analytics, and customization.

3. **Chat Interface**

   - Purpose: Seamless communication with customers.

   - Key Functionality: AI toggling, chat history, file attachments.

4. **Campaign Manager**

   - Purpose: Bulk messaging creation and management.

   - Key Functionality: Template setup, review, and activation.

### **Business Requirements**

#### **Access & Authentication**

- Role-based access for clinic admins, secretaries, and managers.

- Secure login via password or Google Sign-In.

#### **Business Rules**

- Data validation for chat records, campaigns, and metrics.

- Processes should ensure no repetitive follow-ups that harm user experience.

- Stripe subscription for R$1 per unique customer served per month. First R$20 in credits are free, then you need to buy credits to use the software.

### **Implementation Priorities**

**High Priority**

- WhatsApp integration and chat interface.

- Virtual assistants for leads and sales.

- Metric monitoring and insights.

- Campaign creation and management.

**Medium Priority**

- Google Calendar integration.

**Low Priority**

- CRM integrations for dental clinics.

- 