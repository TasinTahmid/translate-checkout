import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node"; // Use json from Remix
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

// Server-side function to fetch translations
export async function loader({ request }) {
  // Authenticate user and get session data
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  if (!shop || !accessToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // GraphQL query to fetch checkout translations
  const queryTranslates = `
    query {
      translations(
        first: 10
        locale: "fr"
        resourceType: SHOP
        query: "key:checkout.payment.instructions"
      ) {
        edges {
          node {
            key
            value
            locale
          }
        }
      }
    }
  `;

  const queryProducts = `query{
    products(first: 10) {
      edges {
        node {
          id
          title
          
        }
      }
    }
  }`;
  // Make the API call from the server-side
  const response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queryProducts }),
  });

  const data = await response.json();
  console.log("API shop:", shop); 
  console.log("API Response:", data); 
  // Return the data to the frontend
  return new Response(
    JSON.stringify({ shop, translations: data }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

export default function TranslationPage() {
  const { shop, translations } = useLoaderData();
  console.log("shop in front:: ",shop)
  console.log("tranlate in front:: ",translations)

  return (
    <Page>
      <TitleBar title="Translation Page" />
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd">Checkout Translations:</Text>
            {translations.length > 0 ? (
              translations.map((t, index) => (
                <Text key={index}>
                  {t.node.key}: {t.node.value} ({t.node.locale})
                </Text>
              ))
            ) : (
              <Text>No translations found.</Text>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}


// return new Response(JSON.stringify({ shop, accessToken }), {
//   headers: { "Content-Type": "application/json" },
// });