import {
  Fragment,
  createElement,
  type ComponentType,
  type FormEvent,
  type ReactElement,
  type ReactNode,
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
  readonly editHref: (id: string) => string;
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
  empty = "No documents found.",
}: CmsCollectionListProps): ReactElement {
  const headingId = `cms-${collection.slug}-heading`;
  const filterable = collection.fields.filter(
    (field) =>
      field.indexed ||
      field.kind === "text" ||
      field.kind === "select" ||
      field.kind === "relationship",
  );
  const columns = defaultColumns(collection);
  return (
    <section aria-labelledby={headingId}>
      <header>
        <h1 id={headingId}>{collection.labels.plural}</h1>
        <a href={createHref}>Create {collection.labels.singular}</a>
      </header>
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
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                {columns.map((name) => (
                  <td key={name}>{displayValue(document.data[name])}</td>
                ))}
                <td>{document.status}</td>
                <td>
                  <a
                    aria-label={`Edit ${displayValue(document.data[useAsTitle(collection)])}`}
                    href={editHref(document.id)}
                  >
                    Edit
                  </a>
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
          {!field.multiple && !field.required ? (
            <option value="">None</option>
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
          {!field.hasMany && !field.required ? (
            <option value="">None</option>
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
};

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
}: CmsCollectionFormProps): ReactElement {
  const headingId = `cms-${collection.slug}-${mode}-heading`;
  const errorEntries = Object.entries(errors);
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
        {collection.fields.map((field) => {
          if (!isCmsFieldVisible(field, data)) return null;
          const controlId = `cms-${collection.slug}-${field.name}`;
          const Control =
            controls?.byField?.[`${collection.slug}.${field.name}`] ??
            controls?.byKind?.[field.kind] ??
            BuiltInCollectionFieldControl;
          return (
            <fieldset
              key={field.name}
              disabled={saving || field.admin?.readOnly}
            >
              <legend>{field.label}</legend>
              <Control
                collection={collection}
                field={field as CmsBuiltInField}
                controlId={controlId}
                value={data[field.name]}
                data={data}
                disabled={saving || Boolean(field.admin?.readOnly)}
                error={errors[field.name]}
                relationshipOptions={
                  field.kind === "relationship"
                    ? (relationshipOptions[
                        (
                          field as Extract<
                            CmsBuiltInField,
                            { kind: "relationship" }
                          >
                        ).relationTo
                      ] ?? [])
                    : []
                }
                setValue={(value) => {
                  const next = { ...data };
                  if (value === undefined) delete next[field.name];
                  else next[field.name] = value;
                  onChange(next);
                }}
              />
              {errors[field.name] ? (
                <p id={`${controlId}-error`}>{errors[field.name]}</p>
              ) : null}
            </fieldset>
          );
        })}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
        </button>
        <a href={cancelHref}>Cancel</a>
      </form>
    </section>
  );
}

export type CmsCollectionAdminShellProps = {
  readonly registry: CmsCollectionRegistry;
  readonly collection: string;
  readonly mode: "list" | "create" | "edit";
  readonly collectionHref: (slug: string) => string;
  readonly createHref: string;
  readonly editHref: (id: string) => string;
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
        />
      )}
    </Fragment>
  );
}
