import { useLoaderData, Form, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text } from "@shopify/polaris";
import styles from "./_index/app-translate.module.css";
import { useEffect, useState } from "react";

export const links = () => [{ rel: "stylesheet", href: styles }];

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
  const queryTranslatables = `
    query {
      translatableResources(first: 10, resourceType: PAYMENT_GATEWAY) {
        edges {
          node {
            resourceId
            translatableContent {
              key
              value
              digest
              locale
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${shop}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: queryTranslatables }),
    },
  );

  const data = await response.json();
  return new Response(
    JSON.stringify({
      shop,
      translatables: data.data.translatableResources.edges,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// action function to handle form submission
export const action = async ({ request }) => {
  // Authenticate user and get session data
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  if (!shop || !accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse form data
  const formData = new URLSearchParams(await request.text());
  const mutationQuery = formData.get("mutationQuery");

  console.log("all", formData);

  if (!mutationQuery) {
    return new Response(
      JSON.stringify({ error: "Translation value is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // GraphQL Mutation
  const MUTATION = `
    mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        translations {
          key
          value
          locale
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutationQuery,
        }),
      },
    );
    console.log("resposne::", response);

    const result = await response.json();

    if (result.data?.translationsRegister?.userErrors?.length) {
      return new Response(
        JSON.stringify({ error: result.data.translationsRegister.userErrors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        translations: result.data.translationsRegister.translations,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export default function TranslationPage() {
  const { shop, translatables } = useLoaderData();
  const submit = useSubmit();
  const [translatablesList, setTranslatablesList] = useState({});

  const handleTranslationChange = (e, digest) => {
    const { value } = e.target;
    setTranslatablesList((prev) => ({
      ...prev,
      [digest]: value,
    }));
  };

  function buildTranslationMutation(translationsByResource) {
    let mutationParts = Object.entries(translationsByResource)
      .map(([resourceId, translations], index) => {
        return `
          paymentGateway${index + 1}: translationsRegister(
            resourceId: "${resourceId}",
            translations: ${JSON.stringify(translations).replace(/"([^"]+)":/g, "$1:")}
          ) {
            translations {
              key
              value
              locale
            }
            userErrors {
              field
              message
            }
          }
        `;
      })
      .join("\n");

    return `mutation { ${mutationParts} }`;
  }

  const handleSubmitTranslation = (e) => {
    e.preventDefault();
    console.log("Submitting translation:::", translatables);

    const translateFormData = {};
    translatables.map((translatable) => {
      if (!translateFormData[translatable.node.resourceId]) {
        translateFormData[translatable.node.resourceId] = [];
      }
      translatable?.node?.translatableContent?.map((content) => {
        if (translatablesList[content.digest]) {
          translateFormData[translatable.node.resourceId].push({
            key: content.key,
            locale: "bn",
            translatableContentDigest: content.digest,
            value: translatablesList[content.digest],
          });
        }
      });
    });

    const graphqlQuery = buildTranslationMutation(translateFormData);
    console.log("gql query::::", graphqlQuery);
    submit({ mutationQuery: graphqlQuery }, { method: "post" });
  };

  useEffect(() => {
    let map = {};
    translatables.map((translatable) => {
      translatable?.node?.translatableContent?.map((content) => {
        map[content.digest] = "";
      });
    });

    setTranslatablesList(map);
  }, []);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" className={styles.headingMd}>
              Checkout Translations:
            </Text>
            {translatables.length > 0 ? (
              <Form method="post">
                <div className={styles.submitDiv}>
                  <button
                    className={styles.submitBtn}
                    onClick={handleSubmitTranslation}
                  >
                    Save
                  </button>
                </div>
                <table className={styles.table}>
                  <thead className={styles.thead}>
                    <tr>
                      <th className={styles.th}>Payment Method Name</th>
                      <th className={styles.th}>Key</th>
                      <th className={styles.th}>Value</th>
                      <th className={styles.th}>Translations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {translatables.map(({ node }) =>
                      node.translatableContent.map((content, index) => (
                        <tr key={index}>
                          <td className={styles.td}>
                            {node.translatableContent.find(
                              (item) => item.key === "name",
                            )?.value || "Unknown"}
                          </td>
                          <td className={styles.td}>{content.key}</td>
                          <td className={`${styles.td} ${styles.tdPre}`}>
                            {content.value}
                          </td>
                          <td className={styles.td}>
                            {content.key === "name" ? (
                              <input
                                type="text"
                                className={styles.nameInput}
                                placeholder="Enter translation"
                                value={translatablesList[content.digest]}
                                onChange={(e) =>
                                  handleTranslationChange(e, content.digest)
                                }
                                name={content.key}
                              />
                            ) : (
                              <textarea
                                className={styles.messageTextarea}
                                placeholder="Enter translation"
                                value={translatablesList[content.digest]}
                                onChange={(e) =>
                                  handleTranslationChange(e, content.digest)
                                }
                                name={content.key}
                              />
                            )}
                          </td>
                          {/* <td className={styles.td}>
                            <input
                              type="hidden"
                              name="resourceId"
                              value={node.resourceId}
                            />
                            <input
                              type="hidden"
                              name="key"
                              value={content.key}
                            />
                            <input
                              type="hidden"
                              name="digest"
                              value={content.digest}
                            />
                            <button type="submit" className={styles.submitBtn}>
                              Submit
                            </button>
                          </td> */}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </Form>
            ) : (
              <Text>No translations found.</Text>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
