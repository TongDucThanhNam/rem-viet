import express from "express";
import { Client } from "@notionhq/client";

const router = express.Router();

/*
  {
    "object": "page",
    "id": "115a4dca-6cc6-81a4-bcbf-fe2d7b901dcc",
    "created_time": "2024-10-04T15:23:00.000Z",
    "last_edited_time": "2024-10-04T15:23:00.000Z",
    "created_by": {
      "object": "user",
      "id": "e0478a0c-0d7d-42bc-ad31-63d507d666c4"
    },
    "last_edited_by": {
      "object": "user",
      "id": "e0478a0c-0d7d-42bc-ad31-63d507d666c4"
    },
    "cover": {
      "type": "external",
      "external": {
        "url": "https://images.unsplash.com/photo-1503416997304-7f8bf166c121?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb"
      }
    },
    "icon": null,
    "parent": {
      "type": "database_id",
      "database_id": "2e317345-0779-40b1-95fb-3cc633e007d6"
    },
    "archived": false,
    "in_trash": false,
    "properties": {
      "tags": {
        "id": "%26Cfp",
        "type": "multi_select",
        "multi_select": [
          {
            "id": "1b62fd6c-47e3-4dea-86c2-aa4b4bdef994",
            "name": "Space",
            "color": "gray"
          },
          {
            "id": "b99fd6fe-f3eb-4a92-815d-bf0b13321ef4",
            "name": "Dark Mode",
            "color": "purple"
          },
          {
            "id": "c375218a-f9a5-4c3e-9cba-fa0cdb1a96ac",
            "name": "Article",
            "color": "pink"
          }
        ]
      },
      "Last edited time": {
        "id": "RL_%3E",
        "type": "last_edited_time",
        "last_edited_time": "2024-10-04T15:23:00.000Z"
      },
      "Created time": {
        "id": "%5Dbl%3A",
        "type": "created_time",
        "created_time": "2024-10-04T15:23:00.000Z"
      },
      "status": {
        "id": "iRQ%22",
        "type": "select",
        "select": {
          "id": "14b7cab2-7f1b-456f-a7ca-e4c57a2458b8",
          "name": "published",
          "color": "pink"
        }
      },
      "publish_date": {
        "id": "rmQ'",
        "type": "date",
        "date": {
          "start": "2023-10-30",
          "end": null,
          "time_zone": null
        }
      },
      "description": {
        "id": "%7C%5BN%60",
        "type": "rich_text",
        "rich_text": [
          {
            "type": "text",
            "text": {
              "content": "What happens when Dark Mode travels at the speed of light? HyperDark, engage!",
              "link": null
            },
            "annotations": {
              "bold": false,
              "italic": false,
              "strikethrough": false,
              "underline": false,
              "code": false,
              "color": "default"
            },
            "plain_text": "What happens when Dark Mode travels at the speed of light? HyperDark, engage!",
            "href": null
          }
        ]
      },
      "title": {
        "id": "title",
        "type": "title",
        "title": [
          {
            "type": "text",
            "text": {
              "content": "Beyond the Moon: Using AstroNot for HyperDark space travel?",
              "link": null
            },
            "annotations": {
              "bold": false,
              "italic": false,
              "strikethrough": false,
              "underline": false,
              "code": false,
              "color": "default"
            },
            "plain_text": "Beyond the Moon: Using AstroNot for HyperDark space travel?",
            "href": null
          }
        ]
      }
    },
    "url": "https://www.notion.so/Beyond-the-Moon-Using-AstroNot-for-HyperDark-space-travel-115a4dca6cc681a4bcbffe2d7b901dcc",
    "public_url": null
  },
 */

interface Post {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: {
    object: string;
    id: string;
  };
  last_edited_by: {
    object: string;
    id: string;
  };
  cover: {
    type: string;
    external: {
      url: string;
    };
  };
  parent: {
    type: string;
    database_id: string;
  };
  icon: any;
  archive: boolean;
  in_trash: boolean;
  properties: {
    tags: {
      id: string;
      type: string;
      multi_select: {
        id: string;
        name: string;
        color: string;
      }[];
    };
    "Last edited time": {
      id: string;
      type: string;
      last_edited_time: string;
    };
    "Created time": {
      id: string;
      type: string;
      created_time: string;
    };
    status: {
      id: string;
      type: string;
      select: {
        id: string;
        name: string;
        color: string;
      };
    };
    publish_date: {
      id: string;
      type: string;
      date: {
        start: string;
        end: string;
        time_zone: string;
      };
    };
    description: {
      id: string;
      type: string;
      rich_text: {
        type: string;
        text: {
          content: string;
          link: string;
        };
        annotations: {
          bold: boolean;
          italic: boolean;
          strikethrough: boolean;
          underline: boolean;
          code: boolean;
          color: string;
        };
        plain_text: string;
        href: string;
      }[];
    };
    title: {
      id: string;
      type: string;
      title: {
        type: string;
        text: {
          content: string;
          link: string;
        };
        annotations: {
          bold: boolean;
          italic: boolean;
          strikethrough: boolean;
          underline: boolean;
          code: boolean;
          color: string;
        };
        plain_text: string;
        href: string;
      }[];
    };
  };
  url: string;
  public_url: any;
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

//check null
if (!databaseId) {
  console.error("Không tìm thấy NOTION_DATABASE_ID trong file .env");
  process.exit(1);
}

//Slug map to id
const slugMap = new Map();
var slugify = require('slugify')



router.get("/posts", async (req, res) => {
  /*
                    #swagger.tags = ['Posts']
                    #swagger.description = 'API to get all posts'
                    #swagger.responses[200] = {
                        description: 'Get all posts',
                    }
                 */

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const posts = response.results.map((page) => {
      const post = page as Post;

      let slug = slugify(post.properties.title.title[0].plain_text, {
        lower: true,
        locale: 'vi'
      });

      slugMap.set(slug, post.id);

      return {
        id: post.id,
        title: post.properties.title.title[0].plain_text,
        slug: slug,
        description: post.properties.description.rich_text[0]?.plain_text || "",
        cover: post.cover?.external.url || "",
        tags: post.properties.tags.multi_select.map((tag) => tag.name),
        status: post.properties.status.select.name,
        created_time: post.created_time,
        last_edited_time: post.last_edited_time,
        url: post.url,
      };
    });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching posts from Notion" });
  }
});

router.get("/posts/:id", async (req, res) => {
  /*
                    #swagger.tags = ['Posts']
                    #swagger.description = 'API to get post by id'
                    #swagger.parameters['id'] = {description: 'Post id', type: 'string', schema: { $ref: "#/definitions/Posts" }, required: true, example: "115a4dca-6cc6-81a4-bcbf-fe2d7b901dcc"}
                    #swagger.responses[200] = {
                        description: 'Get post by id',
                    }
                 */

  try {
    let { id } = req.params;
    if (slugMap.has(id)) {
      id = slugMap.get(id);
    }

    const response: any = await notion.pages.retrieve({ page_id: id });
    const blocks: any = await notion.blocks.children.list({ block_id: id });

    const post = {
      id: response.id,
      title: response.properties.title.title[0]?.plain_text || "Untitled",
      description:
        response.properties.description.rich_text[0]?.plain_text || "",
      publishDate: response.properties.publish_date.date?.start || "",
      tags: response.properties.tags.multi_select.map(
        (tag: { name: any }) => tag.name,
      ),
      coverImage: response.cover?.external?.url || "",
      status: response.properties.status.select?.name || "draft",
      url: response.url,
      lastEditedTime: response.last_edited_time,
      content: blocks.results,
      table_of_contents: blocks.table_of_contents,
    };

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching post from Notion" });
  }
});

export default router;
