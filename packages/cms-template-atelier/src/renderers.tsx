import type { ReactNode } from "react";

import {
  atelierDataSchemas,
  parseAtelierPublicNode,
  type AtelierBlockType,
  type AtelierPublicNode,
} from "./contracts.js";

type Renderer = (node: AtelierPublicNode) => ReactNode;

const renderers: Record<AtelierBlockType, Renderer> = {
  masthead: (node) => {
    const data = atelierDataSchemas.masthead.parse(node.data);
    return (
      <header className="atelier-masthead">
        <p>{data.issue}</p>
        <h1>{data.title}</h1>
        <p>{data.summary}</p>
      </header>
    );
  },
  issueIndex: (node) => {
    const data = atelierDataSchemas.issueIndex.parse(node.data);
    return (
      <nav className="atelier-index" aria-label={data.title}>
        <h2>{data.title}</h2>
        <ol>
          {data.entries.map((entry) => (
            <li key={entry.number}>
              <span>{entry.number}</span>
              {entry.label}
            </li>
          ))}
        </ol>
      </nav>
    );
  },
  storyCard: (node) => {
    const data = atelierDataSchemas.storyCard.parse(node.data);
    return (
      <article className="atelier-story">
        <p>{data.kicker}</p>
        <h2>{data.title}</h2>
        <p>{data.dek}</p>
        <a href={data.href}>Read story</a>
      </article>
    );
  },
  mediaFeature: (node) => {
    const data = atelierDataSchemas.mediaFeature.parse(node.data);
    return (
      <figure className="atelier-media">
        <img src={data.image.src} alt={data.image.alt} />
        <figcaption>{data.caption}</figcaption>
      </figure>
    );
  },
  quotePull: (node) => {
    const data = atelierDataSchemas.quotePull.parse(node.data);
    return (
      <figure className="atelier-quote">
        <blockquote>{data.quote}</blockquote>
        <figcaption>{data.attribution}</figcaption>
      </figure>
    );
  },
  scheduleGrid: (node) => {
    const data = atelierDataSchemas.scheduleGrid.parse(node.data);
    return (
      <section className="atelier-schedule">
        <h2>{data.title}</h2>
        <ul>
          {data.events.map((event) => (
            <li key={`${event.date}-${event.title}`}>
              <time>{event.date}</time>
              <strong>{event.title}</strong>
              <span>{event.location}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  },
  membershipCta: (node) => {
    const data = atelierDataSchemas.membershipCta.parse(node.data);
    return (
      <aside className="atelier-membership">
        <h2>{data.title}</h2>
        <p>{data.body}</p>
        <a href={data.href}>{data.label}</a>
      </aside>
    );
  },
  siteFooter: (node) => {
    const data = atelierDataSchemas.siteFooter.parse(node.data);
    return (
      <footer className="atelier-footer">
        <strong>{data.title}</strong>
        <a href={`mailto:${data.email}`}>{data.email}</a>
      </footer>
    );
  },
  columnLayout: (node) => {
    const data = atelierDataSchemas.columnLayout.parse(node.data);
    return (
      <section className={`atelier-columns atelier-columns--${data.ratio}`}>
        <div>{renderAtelierNodes(node.slots?.primary ?? [])}</div>
        <aside>{renderAtelierNodes(node.slots?.sidebar ?? [])}</aside>
      </section>
    );
  },
};

export function renderAtelierNodes(nodes: readonly AtelierPublicNode[]) {
  return nodes
    .filter((node) => node.enabled)
    .map((input) => {
      const node = parseAtelierPublicNode(input);
      return (
        <div
          data-atelier-block={node.type}
          data-atelier-id={node.id}
          key={node.id}
        >
          {renderers[node.type](node)}
        </div>
      );
    });
}

export function AtelierDocument({
  nodes,
}: {
  nodes: readonly AtelierPublicNode[];
}) {
  return <main className="atelier-site">{renderAtelierNodes(nodes)}</main>;
}
