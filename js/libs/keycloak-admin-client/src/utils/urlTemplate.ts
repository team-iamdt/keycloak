export type PrimitiveValue = string | number | boolean | null;

export interface Template {
  expand(
    context: Record<
      string,
      PrimitiveValue | PrimitiveValue[] | Record<string, PrimitiveValue>
    >
  ): string;
}

function encodeReserved(str: any) {
  return str
    .split(/(%[0-9A-Fa-f]{2})/g)
    .map((part: any) => {
      if (!/%[0-9A-Fa-f]/.test(part)) {
        part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
      }
      return part;
    })
    .join("");
}

function encodeUnreserved(str: any) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeValue(operator: any, value: any, key?: any) {
  value =
    operator === "+" || operator === "#"
      ? encodeReserved(value)
      : encodeUnreserved(value);

  if (key) {
    return encodeUnreserved(key) + "=" + value;
  } else {
    return value;
  }
}

function isDefined(value: any) {
  return value !== undefined && value !== null;
}

function isKeyOperator(operator: any) {
  return operator === ";" || operator === "&" || operator === "?";
}

function getValues(context: any, operator: any, key: any, modifier: any) {
  let value = context[key];
  const result = [];

  if (isDefined(value) && value !== "") {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      value = value.toString();

      if (modifier && modifier !== "*") {
        value = value.substring(0, parseInt(modifier, 10));
      }

      result.push(
        encodeValue(operator, value, isKeyOperator(operator) ? key : null)
      );
    } else {
      if (modifier === "*") {
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach((value) => {
            result.push(
              encodeValue(operator, value, isKeyOperator(operator) ? key : null)
            );
          });
        } else {
          Object.keys(value).forEach((k) => {
            if (isDefined(value[k])) {
              result.push(encodeValue(operator, value[k], k));
            }
          });
        }
      } else {
        const tmp: any[] = [];

        if (Array.isArray(value)) {
          value.filter(isDefined).forEach((value) => {
            tmp.push(encodeValue(operator, value));
          });
        } else {
          Object.keys(value).forEach((k) => {
            if (isDefined(value[k])) {
              tmp.push(encodeUnreserved(k));
              tmp.push(encodeValue(operator, value[k].toString()));
            }
          });
        }

        if (isKeyOperator(operator)) {
          result.push(encodeUnreserved(key) + "=" + tmp.join(","));
        } else if (tmp.length !== 0) {
          result.push(tmp.join(","));
        }
      }
    }
  } else {
    if (operator === ";") {
      if (isDefined(value)) {
        result.push(encodeUnreserved(key));
      }
    } else if (value === "" && (operator === "&" || operator === "?")) {
      result.push(encodeUnreserved(key) + "=");
    } else if (value === "") {
      result.push("");
    }
  }
  return result;
}

export function parseTemplate(template: string) {
  const operators = ["+", "#", ".", "/", ";", "?", "&"];

  return {
    expand: function (
      context: Record<
        string,
        PrimitiveValue | PrimitiveValue[] | Record<string, PrimitiveValue>
      >
    ): string {
      return template.replace(
        /\{([^{}]+)\}|([^{}]+)/g,
        (_, expression, literal) => {
          if (expression) {
            let operator: string | null = null;
            const values: any[] = [];

            if (operators.includes(expression.charAt(0))) {
              operator = expression.charAt(0);
              expression = expression.substr(1);
            }

            expression.split(/,/g).forEach((variable: any) => {
              const tmp = /([^:*]*)(?::(\d+)|(\*))?/.exec(variable);
              // eslint-disable-next-line prefer-spread
              values.push.apply(
                values,
                getValues(context, operator, tmp![1], tmp![2] || tmp![3])
              );
            });

            if (operator && operator !== "+") {
              let separator = ",";

              if (operator === "?") {
                separator = "&";
              } else if (operator !== "#") {
                separator = operator;
              }
              return (
                (values.length !== 0 ? operator : "") + values.join(separator)
              );
            } else {
              return values.join(",");
            }
          } else {
            return encodeReserved(literal);
          }
        }
      );
    },
  } satisfies Template;
}
