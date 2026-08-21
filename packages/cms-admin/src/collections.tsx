import {
  Fragment,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import {
  CmsError,
  isCmsFieldVisible,
  parseCmsCollectionData,
  type CmsBuiltInField,
  type CmsCollectionDefinition,
  type CmsCollectionRegistry,
} from "@agency/cms-core";

export type CmsCollectionAdminDocument = {
  readonly id: string;
  readonly version: number;
  readonly status: "draft" | "published";
  readonly data: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
  readonly updatedBy?: string;
  readonly locale?: string | null;
  readonly fallbackFrom?: string | null;
};

export type CmsRelationshipOption = {
  readonly id: string;
  readonly label: string;
};

export type CmsCollectionFieldControlProps = {
  readonly collection: CmsCollectionDefinition;
  readonly field: CmsBuiltInField;
  readonly controlId: string;
  readonly value: unknown;
  readonly data: Readonly<Record<string, unknown>>;
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly relationshipOptions: readonly CmsRelationshipOption[];
  readonly relationshipOptionsByCollection?: Readonly<
    Record<string, readonly CmsRelationshipOption[]>
  >;
  readonly controls?: CmsCollectionFieldControlRegistry;
  readonly fieldPath?: string;
  readonly setValue: (value: unknown) => void;
};

export type CmsCollectionFieldControlRegistry = Readonly<{
  byField?: Readonly<
    Record<string, ComponentType<CmsCollectionFieldControlProps>>
  >;
  byKind?: Readonly<
    Record<string, ComponentType<CmsCollectionFieldControlProps>>
  >;
}>;

export function createCollectionFieldControlRegistry(
  registry: CmsCollectionFieldControlRegistry,
): CmsCollectionFieldControlRegistry {
  return Object.freeze({
    byField: Object.freeze({ ...(registry.byField ?? {}) }),
    byKind: Object.freeze({ ...(registry.byKind ?? {}) }),
  });
}

export type CmsCollectionAdminValidationResult =
  | {
      readonly success: true;
      readonly data: Readonly<Record<string, unknown>>;
      readonly errors: Readonly<Record<string, never>>;
    }
  | {
      readonly success: false;
      readonly data: null;
      readonly errors: Readonly<Record<string, string>>;
    };

export function validateCmsCollectionAdminData(
  collection: CmsCollectionDefinition,
  data: unknown,
): CmsCollectionAdminValidationResult {
  try {
    return {
      success: true,
      data: parseCmsCollectionData(
        collection as CmsCollectionDefinition<
          string,
          readonly CmsBuiltInField[]
        >,
        data,
      ),
      errors: {},
    };
  } catch (error) {
    if (!(error instanceof CmsError) || error.code !== "VALIDATION_FAILED") {
      throw error;
    }
    const errors: Record<string, string> = {};
    const issues = error.details?.issues;
    if (Array.isArray(issues)) {
      for (const issue of issues) {
        if (!issue || typeof issue !== "object") continue;
        const path =
          "path" in issue && Array.isArray(issue.path) ? issue.path : [];
        const field = typeof path[0] === "string" ? path[0] : "_form";
        const message =
          "message" in issue && typeof issue.message === "string"
            ? issue.message
            : error.message;
        errors[field] ??= message;
      }
    }
    if (!Object.keys(errors).length) errors._form = error.message;
    return { success: false, data: null, errors };
  }
}

function definitionFor(
  registry: CmsCollectionRegistry,
  slug: string,
): CmsCollectionDefinition<string, readonly CmsBuiltInField[]> {
  const definition = registry.collections.find(
    (collection) => collection.slug === slug,
  );
  if (!definition) {
    throw new CmsError({
      code: "NOT_FOUND",
      message: `Collection \"${slug}\" is not registered.`,
      retryable: false,
    });
  }
  return definition as CmsCollectionDefinition<
    string,
    readonly CmsBuiltInField[]
  >;
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function defaultColumns(collection: CmsCollectionDefinition) {
  return (
    collection.admin?.defaultColumns ??
    collection.fields.slice(0, 4).map((field) => field.name)
  );
}

function useAsTitle(collection: CmsCollectionDefinition) {
  return collection.admin?.useAsTitle ?? collection.fields[0]?.name ?? "id";
}

export type CmsCollectionNavigationProps = {
  readonly registry: CmsCollectionRegistry;
  readonly current: string;
  readonly collectionHref: (slug: string) => string;
};

export function CmsCollectionNavigation({
  registry,
  current,
  collectionHref,
}: CmsCollectionNavigationProps): ReactElement {
  return (
    <nav aria-label="Collections">
      <ul>
        {registry.collections.map((collection) => (
          <li key={collection.slug}>
            <a
              aria-current={collection.slug === current ? "page" : undefined}
              href={collectionHref(collection.slug)}
            >
              {collection.labels.plural}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type CmsCollectionFilterValue = {
  readonly field: string;
  readonly operator: "contains" | "equals";
  readonly value: string;
};

export type CmsCollectionListProps = {
  readonly collection: CmsCollectionDefinition;
  readonly documents: readonly CmsCollectionAdminDocument[];
  readonly total?: number;
  readonly filter: CmsCollectionFilterValue;
  readonly onFilterChange: (filter: CmsCollectionFilterValue) => void;
  readonly createHref: string;
  readonly editHref: (id: string, locale?: string) => string;
  readonly previewHref?: (id: string, locale?: string) => string;
  readonly locale?: string;
  readonly onLocaleChange?: (locale: string) => void;
  readonly empty?: ReactNode;
};

export function CmsCollectionList({
  collection,
  documents,
  total = documents.length,
  filter,
  onFilterChange,
  createHref,
  editHref,
  previewHref,
  locale,
  onLocaleChange,
  empty = "No documents found.",
}: CmsCollectionListProps): ReactElement {
  const headingId = `cms-${collection.slug}-heading`;
  const filterable = collection.fields.filter(
    (field) =>
      field.indexed ||
      field.kind === "text" ||
      field.kind === "select" ||
      field.kind === "relationship" ||
      field.kind === "polymorphic-relationship",
  );
  const columns = defaultColumns(collection);
  return (
    <section aria-labelledby={headingId}>
      <header>
        <h1 id={headingId}>{collection.labels.plural}</h1>
        <a href={createHref}>Create {collection.labels.singular}</a>
      </header>
      {collection.localization ? (
        <div>
          <label htmlFor={`cms-${collection.slug}-locale`}>Locale</label>
          <select
            id={`cms-${collection.slug}-locale`}
            value={locale ?? collection.localization.defaultLocale}
            onChange={(event) => onLocaleChange?.(event.currentTarget.value)}
          >
            {collection.localization.locales.map((availableLocale) => (
              <option key={availableLocale} value={availableLocale}>
                {availableLocale}
              </option>
            ))}
          </select>
          <p aria-live="polite">
            Showing {locale ?? collection.localization.defaultLocale} locale
          </p>
        </div>
      ) : null}
      {filterable.length ? (
        <form
          aria-label={`Filter ${collection.labels.plural}`}
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor={`cms-${collection.slug}-filter-field`}>
            Filter field
          </label>
          <select
            id={`cms-${collection.slug}-filter-field`}
            value={filter.field}
            onChange={(event) =>
              onFilterChange({ ...filter, field: event.currentTarget.value })
            }
          >
            {filterable.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label}
              </option>
            ))}
          </select>
          <label htmlFor={`cms-${collection.slug}-filter-operator`}>
            Filter operator
          </label>
          <select
            id={`cms-${collection.slug}-filter-operator`}
            value={filter.operator}
            onChange={(event) =>
              onFilterChange({
                ...filter,
                operator: event.currentTarget.value as "contains" | "equals",
              })
            }
          >
            <option value="contains">Contains</option>
            <option value="equals">Equals</option>
          </select>
          <label htmlFor={`cms-${collection.slug}-filter-value`}>
            Filter value
          </label>
          <input
            id={`cms-${collection.slug}-filter-value`}
            type="search"
            value={filter.value}
            onChange={(event) =>
              onFilterChange({ ...filter, value: event.currentTarget.value })
            }
          />
          <button type="submit">Apply filter</button>
        </form>
      ) : null}
      <p aria-live="polite">{total} total</p>
      {documents.length ? (
        <table>
          <caption>{collection.labels.plural} collection</caption>
          <thead>
            <tr>
              {columns.map((name) => (
                <th key={name} scope="col">
                  {collection.fields.find((field) => field.name === name)
                    ?.label ?? name}
                </th>
              ))}
              <th scope="col">Status</th>
              {collection.localization ? <th scope="col">Locale</th> : null}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={`${document.id}:${document.locale ?? "shared"}`}>
                {columns.map((name) => (
                  <td key={name}>{displayValue(document.data[name])}</td>
                ))}
                <td>{document.status}</td>
                {collection.localization ? (
                  <td>
                    {document.locale ?? locale}
                    {document.fallbackFrom
                      ? ` (fallback for ${document.fallbackFrom})`
                      : ""}
                  </td>
                ) : null}
                <td>
                  <a
                    aria-label={`Edit ${displayValue(document.data[useAsTitle(collection)])}`}
                    href={editHref(document.id, document.locale ?? locale)}
                  >
                    Edit
                  </a>
                  {previewHref ? (
                    <a
                      aria-label={`Preview ${displayValue(document.data[useAsTitle(collection)])} in ${document.locale ?? locale ?? "default"}`}
                      href={previewHref(document.id, document.locale ?? locale)}
                    >
                      Preview
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p role="status">{empty}</p>
      )}
    </section>
  );
}

function jsonControl(props: CmsCollectionFieldControlProps, label: string) {
  const describedBy = props.error
    ? `${props.controlId}-description ${props.controlId}-error`
    : `${props.controlId}-description`;
  return (
    <Fragment>
      <label htmlFor={props.controlId}>{props.field.label}</label>
      <p id={`${props.controlId}-description`}>
        {props.field.admin?.description ?? label}
      </p>
      <textarea
        id={props.controlId}
        name={props.field.name}
        required={props.field.required}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy}
        defaultValue={JSON.stringify(props.value ?? null, null, 2)}
        onBlur={(event) => {
          try {
            props.setValue(JSON.parse(event.currentTarget.value));
          } catch {
            // The shared collection validator reports malformed structured data on submit.
          }
        }}
      />
    </Fragment>
  );
}

function nestedFieldControls(input: {
  props: CmsCollectionFieldControlProps;
  fields: readonly CmsBuiltInField[];
  record: Readonly<Record<string, unknown>>;
  path: string;
  setRecord: (record: Readonly<Record<string, unknown>>) => void;
}) {
  return input.fields.map((field) => {
    if (!isCmsFieldVisible(field, input.record)) return null;
    const fieldPath = `${input.path}.${field.name}`;
    const controlId = `${input.props.controlId}-${field.name}`;
    const Control =
      input.props.controls?.byField?.[
        `${input.props.collection.slug}.${fieldPath}`
      ] ??
      input.props.controls?.byKind?.[field.kind] ??
      BuiltInCollectionFieldControl;
    return (
      <div key={field.name} data-cms-field-path={fieldPath}>
        <Control
          {...input.props}
          field={field}
          fieldPath={fieldPath}
          controlId={controlId}
          data={input.record}
          value={input.record[field.name] ?? field.defaultValue}
          error={undefined}
          relationshipOptions={
            field.kind === "relationship"
              ? (input.props.relationshipOptionsByCollection?.[
                  field.relationTo
                ] ?? [])
              : []
          }
          setValue={(value) => {
            const next = { ...input.record };
            if (value === undefined) delete next[field.name];
            else next[field.name] = value;
            input.setRecord(next);
          }}
        />
      </div>
    );
  });
}

function BuiltInCollectionFieldControl(
  props: CmsCollectionFieldControlProps,
): ReactElement {
  const { field, controlId, value, disabled, setValue } = props;
  const common = {
    id: controlId,
    name: field.name,
    required: field.required,
    disabled,
    "aria-invalid": props.error ? (true as const) : undefined,
    "aria-describedby":
      [
        field.admin?.description ? `${controlId}-description` : "",
        props.error ? `${controlId}-error` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  let control: ReactElement;
  switch (field.kind) {
    case "text":
      control = field.multiline ? (
        <textarea
          {...common}
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      ) : (
        <input
          {...common}
          type="text"
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          pattern={field.validation?.pattern}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "number":
      control = (
        <input
          {...common}
          type="number"
          value={typeof value === "number" ? value : ""}
          min={field.validation?.min}
          max={field.validation?.max}
          step={field.validation?.integer ? 1 : "any"}
          onChange={(event) =>
            setValue(
              event.currentTarget.value === ""
                ? undefined
                : event.currentTarget.valueAsNumber,
            )
          }
        />
      );
      break;
    case "boolean":
      control = (
        <input
          {...common}
          type="checkbox"
          checked={value === true}
          onChange={(event) => setValue(event.currentTarget.checked)}
        />
      );
      break;
    case "date":
      control = (
        <input
          {...common}
          type={field.mode === "date" ? "date" : "datetime-local"}
          value={typeof value === "string" ? value : ""}
          min={field.validation?.min}
          max={field.validation?.max}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "email":
      control = (
        <input
          {...common}
          type="email"
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "url":
      control = (
        <input
          {...common}
          type="url"
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "slug":
      control = (
        <input
          {...common}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "code":
      control = (
        <textarea
          {...common}
          data-language={field.language}
          spellCheck={false}
          value={typeof value === "string" ? value : ""}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "json":
      return jsonControl(props, "Structured JSON value");
    case "color":
      control = (
        <input
          {...common}
          type={field.alpha ? "text" : "color"}
          pattern={field.alpha ? "#[0-9a-fA-F]{8}" : undefined}
          value={
            typeof value === "string" ? value : field.alpha ? "" : "#000000"
          }
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
      break;
    case "point": {
      const point =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as { latitude?: unknown; longitude?: unknown })
          : {};
      const setCoordinate = (
        coordinate: "latitude" | "longitude",
        next?: number,
      ) =>
        setValue({
          latitude:
            coordinate === "latitude"
              ? next
              : typeof point.latitude === "number"
                ? point.latitude
                : 0,
          longitude:
            coordinate === "longitude"
              ? next
              : typeof point.longitude === "number"
                ? point.longitude
                : 0,
        });
      return (
        <fieldset
          aria-describedby={common["aria-describedby"]}
          aria-invalid={common["aria-invalid"]}
          disabled={disabled}
        >
          <legend>{field.label}</legend>
          {field.admin?.description ? (
            <p id={`${controlId}-description`}>{field.admin.description}</p>
          ) : null}
          <label htmlFor={`${controlId}-latitude`}>Latitude</label>
          <input
            id={`${controlId}-latitude`}
            name={`${field.name}.latitude`}
            type="number"
            min={-90}
            max={90}
            step="any"
            required={field.required}
            value={typeof point.latitude === "number" ? point.latitude : ""}
            onChange={(event) =>
              setCoordinate(
                "latitude",
                event.currentTarget.value === ""
                  ? undefined
                  : event.currentTarget.valueAsNumber,
              )
            }
          />
          <label htmlFor={`${controlId}-longitude`}>Longitude</label>
          <input
            id={`${controlId}-longitude`}
            name={`${field.name}.longitude`}
            type="number"
            min={-180}
            max={180}
            step="any"
            required={field.required}
            value={typeof point.longitude === "number" ? point.longitude : ""}
            onChange={(event) =>
              setCoordinate(
                "longitude",
                event.currentTarget.value === ""
                  ? undefined
                  : event.currentTarget.valueAsNumber,
              )
            }
          />
          {props.error ? (
            <p id={`${controlId}-error`} role="alert">
              {props.error}
            </p>
          ) : null}
        </fieldset>
      );
    }
    case "group": {
      const record =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Readonly<Record<string, unknown>>)
          : {};
      return (
        <div aria-label={`${field.label} fields`} role="group">
          {nestedFieldControls({
            props,
            fields: field.fields as readonly CmsBuiltInField[],
            record,
            path: props.fieldPath ?? field.name,
            setRecord: setValue,
          })}
        </div>
      );
    }
    case "array": {
      const rows = Array.isArray(value)
        ? value.filter(
            (row): row is Readonly<Record<string, unknown>> =>
              Boolean(row) && typeof row === "object" && !Array.isArray(row),
          )
        : [];
      return (
        <div aria-label={`${field.label} rows`} role="group">
          {rows.map((row, index) => (
            <fieldset key={index}>
              <legend>
                {field.label} {index + 1}
              </legend>
              {nestedFieldControls({
                props,
                fields: field.fields as readonly CmsBuiltInField[],
                record: row,
                path: `${props.fieldPath ?? field.name}.${index}`,
                setRecord: (record) =>
                  setValue(
                    rows.map((candidate, candidateIndex) =>
                      candidateIndex === index ? record : candidate,
                    ),
                  ),
              })}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${field.label} row ${index + 1}`}
                onClick={() =>
                  setValue(rows.filter((_, candidate) => candidate !== index))
                }
              >
                Remove row
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={
              disabled ||
              (field.validation?.maxItems !== undefined &&
                rows.length >= field.validation.maxItems)
            }
            onClick={() => setValue([...rows, {}])}
          >
            Add {field.label} row
          </button>
        </div>
      );
    }
    case "select": {
      const values = Array.isArray(value) ? value.map(String) : [];
      control = (
        <select
          {...common}
          multiple={field.multiple}
          value={
            field.multiple ? values : typeof value === "string" ? value : ""
          }
          onChange={(event) =>
            setValue(
              field.multiple
                ? Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  )
                : event.currentTarget.value,
            )
          }
        >
          {!field.multiple ? (
            <option value="" disabled={field.required}>
              {field.required ? "Select an option" : "None"}
            </option>
          ) : null}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "relationship": {
      const values = Array.isArray(value) ? value.map(String) : [];
      control = (
        <select
          {...common}
          multiple={field.hasMany}
          value={
            field.hasMany ? values : typeof value === "string" ? value : ""
          }
          onChange={(event) =>
            setValue(
              field.hasMany
                ? Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  )
                : event.currentTarget.value || undefined,
            )
          }
        >
          {!field.hasMany ? (
            <option value="" disabled={field.required}>
              {field.required ? "Select a related document" : "None"}
            </option>
          ) : null}
          {props.relationshipOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "polymorphic-relationship": {
      const encode = (relation: { relationTo: string; id: string }) =>
        `${relation.relationTo}:${relation.id}`;
      const decode = (encoded: string) => {
        const separator = encoded.indexOf(":");
        return separator < 1
          ? undefined
          : {
              relationTo: encoded.slice(0, separator),
              id: encoded.slice(separator + 1),
            };
      };
      const values = Array.isArray(value)
        ? value
            .filter(
              (relation): relation is { relationTo: string; id: string } =>
                Boolean(
                  relation &&
                  typeof relation === "object" &&
                  "relationTo" in relation &&
                  typeof relation.relationTo === "string" &&
                  "id" in relation &&
                  typeof relation.id === "string",
                ),
            )
            .map(encode)
        : [];
      const single =
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "relationTo" in value &&
        typeof value.relationTo === "string" &&
        "id" in value &&
        typeof value.id === "string"
          ? encode({ relationTo: value.relationTo, id: value.id })
          : "";
      control = (
        <select
          {...common}
          multiple={field.hasMany}
          value={field.hasMany ? values : single}
          onChange={(event) => {
            if (field.hasMany) {
              setValue(
                Array.from(event.currentTarget.selectedOptions)
                  .map((option) => decode(option.value))
                  .filter(
                    (
                      relation,
                    ): relation is { relationTo: string; id: string } =>
                      relation !== undefined,
                  ),
              );
              return;
            }
            setValue(
              event.currentTarget.value
                ? decode(event.currentTarget.value)
                : undefined,
            );
          }}
        >
          {!field.hasMany ? (
            <option value="" disabled={field.required}>
              {field.required ? "Select a related document" : "None"}
            </option>
          ) : null}
          {field.relationTo.map((target) => (
            <optgroup key={target} label={target}>
              {(props.relationshipOptionsByCollection?.[target] ?? []).map(
                (option) => (
                  <option
                    key={`${target}:${option.id}`}
                    value={encode({ relationTo: target, id: option.id })}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </optgroup>
          ))}
        </select>
      );
      break;
    }
    case "computed":
    case "virtual":
    case "join":
      control = (
        <output id={controlId} data-cms-derived={field.kind}>
          {displayValue(value)}
        </output>
      );
      break;
    case "media": {
      const text = Array.isArray(value)
        ? value.join("\n")
        : typeof value === "string"
          ? value
          : "";
      control = (
        <textarea
          {...common}
          value={text}
          onChange={(event) =>
            setValue(
              field.multiple
                ? event.currentTarget.value.split(/\r?\n/).filter(Boolean)
                : event.currentTarget.value,
            )
          }
        />
      );
      break;
    }
    case "rich-text":
      return jsonControl(props, "Structured rich-text JSON fallback");
    case "blocks":
      return jsonControl(props, "Structured blocks JSON fallback");
  }
  return (
    <Fragment>
      <label htmlFor={controlId}>{field.label}</label>
      {field.admin?.description ? (
        <p id={`${controlId}-description`}>{field.admin.description}</p>
      ) : null}
      {control}
    </Fragment>
  );
}

export type CmsCollectionFormProps = {
  readonly collection: CmsCollectionDefinition;
  readonly mode: "create" | "edit";
  readonly data: Readonly<Record<string, unknown>>;
  readonly errors?: Readonly<Record<string, string>>;
  readonly saving?: boolean;
  readonly controls?: CmsCollectionFieldControlRegistry;
  readonly relationshipOptions?: Readonly<
    Record<string, readonly CmsRelationshipOption[]>
  >;
  readonly onChange: (data: Readonly<Record<string, unknown>>) => void;
  readonly onSubmit: (
    data: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly onValidationError?: (
    errors: Readonly<Record<string, string>>,
  ) => void;
  readonly cancelHref: string;
  readonly locale?: string;
  readonly onLocaleChange?: (locale: string) => void;
  readonly previewHref?: string;
};

function CollectionFormField(input: {
  collection: CmsCollectionDefinition;
  field: CmsBuiltInField;
  data: Readonly<Record<string, unknown>>;
  errors: Readonly<Record<string, string>>;
  saving: boolean;
  controls?: CmsCollectionFieldControlRegistry;
  relationshipOptions: Readonly<
    Record<string, readonly CmsRelationshipOption[]>
  >;
  onChange: (data: Readonly<Record<string, unknown>>) => void;
}) {
  const { collection, field, data, errors, saving, controls } = input;
  if (!isCmsFieldVisible(field, data)) return null;
  const controlId = `cms-${collection.slug}-${field.name}`;
  const Control =
    controls?.byField?.[`${collection.slug}.${field.name}`] ??
    controls?.byKind?.[field.kind] ??
    BuiltInCollectionFieldControl;
  return (
    <fieldset disabled={saving || field.admin?.readOnly}>
      <legend>
        {field.label}
        {collection.localization
          ? field.localized
            ? " (localized)"
            : " (shared)"
          : ""}
      </legend>
      <Control
        collection={collection}
        field={field}
        fieldPath={field.name}
        controls={controls}
        controlId={controlId}
        value={data[field.name]}
        data={data}
        disabled={saving || Boolean(field.admin?.readOnly)}
        error={errors[field.name]}
        relationshipOptions={
          field.kind === "relationship"
            ? (input.relationshipOptions[field.relationTo] ?? [])
            : []
        }
        relationshipOptionsByCollection={input.relationshipOptions}
        setValue={(value) => {
          const next = { ...data };
          if (value === undefined) delete next[field.name];
          else next[field.name] = value;
          input.onChange(next);
        }}
      />
      {errors[field.name] ? (
        <p id={`${controlId}-error`}>{errors[field.name]}</p>
      ) : null}
    </fieldset>
  );
}

export function CmsCollectionForm({
  collection,
  mode,
  data,
  errors = {},
  saving = false,
  controls,
  relationshipOptions = {},
  onChange,
  onSubmit,
  onValidationError,
  cancelHref,
  locale,
  onLocaleChange,
  previewHref,
}: CmsCollectionFormProps): ReactElement {
  const headingId = `cms-${collection.slug}-${mode}-heading`;
  const errorEntries = Object.entries(errors);
  const layout = collection.admin?.layout ?? [];
  const tabGroups = layout.filter((group) => group.type === "tab");
  const [activeTab, setActiveTab] = useState(tabGroups[0]?.id ?? "");
  const fieldByName = new Map(
    collection.fields.map((field) => [field.name, field as CmsBuiltInField]),
  );
  const groupedFields = new Set(layout.flatMap((group) => group.fields));
  const activateTabFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabGroups.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabGroups.length) % tabGroups.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabGroups.length - 1;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = tabGroups[nextIndex];
    if (!next) return;
    setActiveTab(next.id);
    document.getElementById(`cms-${collection.slug}-tab-${next.id}`)?.focus();
  };
  const renderField = (field: CmsBuiltInField) => (
    <CollectionFormField
      key={field.name}
      collection={collection}
      field={field}
      data={data}
      errors={errors}
      saving={saving}
      controls={controls}
      relationshipOptions={relationshipOptions}
      onChange={onChange}
    />
  );
  const renderGroupFields = (names: readonly string[]) =>
    names
      .map((name) => fieldByName.get(name))
      .filter((field): field is CmsBuiltInField => field !== undefined)
      .map(renderField);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateCmsCollectionAdminData(collection, data);
    if (!validation.success) {
      onValidationError?.(validation.errors);
      return;
    }
    void onSubmit(validation.data);
  };
  return (
    <section aria-labelledby={headingId}>
      <h1 id={headingId}>
        {mode === "create" ? "Create" : "Edit"} {collection.labels.singular}
      </h1>
      {collection.localization ? (
        <div>
          <label htmlFor={`cms-${collection.slug}-${mode}-locale`}>
            Editing locale
          </label>
          <select
            id={`cms-${collection.slug}-${mode}-locale`}
            value={locale ?? collection.localization.defaultLocale}
            onChange={(event) => onLocaleChange?.(event.currentTarget.value)}
          >
            {collection.localization.locales.map((availableLocale) => (
              <option key={availableLocale} value={availableLocale}>
                {availableLocale}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {errorEntries.length ? (
        <div role="alert" tabIndex={-1}>
          <h2>Fix the following fields</h2>
          <ul>
            {errorEntries.map(([name, message]) => (
              <li key={name}>
                <a href={`#cms-${collection.slug}-${name}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={submit} noValidate>
        {tabGroups.length ? (
          <div data-cms-layout="tabs">
            <div
              aria-label={`${collection.labels.singular} sections`}
              role="tablist"
            >
              {tabGroups.map((group) => (
                <button
                  key={group.id}
                  id={`cms-${collection.slug}-tab-${group.id}`}
                  type="button"
                  role="tab"
                  tabIndex={activeTab === group.id ? 0 : -1}
                  aria-controls={`cms-${collection.slug}-panel-${group.id}`}
                  aria-selected={activeTab === group.id}
                  onClick={() => setActiveTab(group.id)}
                  onKeyDown={(event) =>
                    activateTabFromKeyboard(event, tabGroups.indexOf(group))
                  }
                >
                  {group.label}
                </button>
              ))}
            </div>
            {tabGroups.map((group) => (
              <section
                key={group.id}
                id={`cms-${collection.slug}-panel-${group.id}`}
                role="tabpanel"
                aria-labelledby={`cms-${collection.slug}-tab-${group.id}`}
                hidden={activeTab !== group.id}
              >
                {renderGroupFields(group.fields)}
              </section>
            ))}
          </div>
        ) : null}
        {layout
          .filter((group) => group.type !== "tab")
          .map((group) => {
            const id = `cms-${collection.slug}-layout-${group.id}`;
            if (group.type === "collapsible") {
              return (
                <details
                  key={group.id}
                  open={!group.collapsed}
                  data-cms-layout="collapsible"
                >
                  <summary>{group.label}</summary>
                  {renderGroupFields(group.fields)}
                </details>
              );
            }
            return (
              <section
                key={group.id}
                aria-labelledby={id}
                data-cms-layout="row"
              >
                <h2 id={id}>{group.label}</h2>
                <div role="group" aria-labelledby={id}>
                  {renderGroupFields(group.fields)}
                </div>
              </section>
            );
          })}
        {collection.fields
          .filter((field) => !groupedFields.has(field.name))
          .map((field) => renderField(field as CmsBuiltInField))}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
        </button>
        <a href={cancelHref}>Cancel</a>
        {mode === "edit" && previewHref ? (
          <a href={previewHref}>Preview this locale</a>
        ) : null}
      </form>
    </section>
  );
}

export type CmsCollectionAdminShellProps = {
  readonly registry: CmsCollectionRegistry;
  readonly collection: string;
  readonly mode: "list" | "create" | "edit";
  readonly documentId?: string;
  readonly collectionHref: (slug: string) => string;
  readonly createHref: string;
  readonly editHref: (id: string, locale?: string) => string;
  readonly previewHref?: (id: string, locale?: string) => string;
  readonly cancelHref: string;
  readonly documents?: readonly CmsCollectionAdminDocument[];
  readonly total?: number;
  readonly filter?: CmsCollectionFilterValue;
  readonly onFilterChange?: (filter: CmsCollectionFilterValue) => void;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly errors?: Readonly<Record<string, string>>;
  readonly saving?: boolean;
  readonly controls?: CmsCollectionFieldControlRegistry;
  readonly relationshipOptions?: Readonly<
    Record<string, readonly CmsRelationshipOption[]>
  >;
  readonly onChange?: (data: Readonly<Record<string, unknown>>) => void;
  readonly onSubmit?: (
    data: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly onValidationError?: (
    errors: Readonly<Record<string, string>>,
  ) => void;
  readonly locale?: string;
  readonly onLocaleChange?: (locale: string) => void;
};

export function CmsCollectionAdminShell(
  props: CmsCollectionAdminShellProps,
): ReactElement {
  const collection = definitionFor(props.registry, props.collection);
  return (
    <Fragment>
      <CmsCollectionNavigation
        registry={props.registry}
        current={collection.slug}
        collectionHref={props.collectionHref}
      />
      {props.mode === "list" ? (
        <CmsCollectionList
          collection={collection}
          documents={props.documents ?? []}
          total={props.total}
          filter={
            props.filter ?? {
              field: collection.fields[0]?.name ?? "id",
              operator: "contains",
              value: "",
            }
          }
          onFilterChange={props.onFilterChange ?? (() => undefined)}
          createHref={props.createHref}
          editHref={props.editHref}
          previewHref={props.previewHref}
          locale={props.locale}
          onLocaleChange={props.onLocaleChange}
        />
      ) : (
        <CmsCollectionForm
          collection={collection}
          mode={props.mode}
          data={props.data ?? {}}
          errors={props.errors}
          saving={props.saving}
          controls={props.controls}
          relationshipOptions={props.relationshipOptions}
          onChange={props.onChange ?? (() => undefined)}
          onSubmit={props.onSubmit ?? (() => undefined)}
          onValidationError={props.onValidationError}
          cancelHref={props.cancelHref}
          locale={props.locale}
          onLocaleChange={props.onLocaleChange}
          previewHref={
            props.mode === "edit" && props.previewHref && props.documentId
              ? props.previewHref(props.documentId, props.locale)
              : undefined
          }
        />
      )}
    </Fragment>
  );
}
