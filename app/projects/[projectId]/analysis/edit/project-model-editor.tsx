"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { EditableProjectModelInput } from "@/schemas/project-model/project-model";

import { saveProjectModelFormAction } from "./actions";

type ProjectModelEditorProps = {
  projectId: string;
  baseModelVersionId: string | null;
  initialModel: EditableProjectModelInput;
  canManage: boolean;
};

const confirmationStatuses = [
  "confirmed",
  "assumed",
  "proposed",
  "unresolved",
  "rejected",
] as const;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando y versionando..." : "Guardar Project Model"}
    </Button>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      {children}
    </select>
  );
}

export function ProjectModelEditor({
  projectId,
  baseModelVersionId,
  initialModel,
  canManage,
}: ProjectModelEditorProps) {
  const [model, setModel] = useState(initialModel);
  const serializedModel = useMemo(
    () => JSON.stringify(model),
    [model]
  );

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso de consulta</CardTitle>
          <CardDescription>
            Solo owner y admin pueden editar y versionar el
            Project Model.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <form action={saveProjectModelFormAction} className="space-y-8">
      <input type="hidden" name="projectId" value={projectId} />
      <input
        type="hidden"
        name="baseModelVersionId"
        value={baseModelVersionId ?? ""}
      />
      <input type="hidden" name="modelPayload" value={serializedModel} />

      <Card>
        <CardHeader>
          <CardTitle>Control del modelo</CardTitle>
          <CardDescription>
            Cada guardado crea una propuesta manual aplicada,
            una nueva versión del Project Model y regenera solo
            los documentos afectados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model-status">Estado del modelo</Label>
            <NativeSelect
              value={model.status}
              ariaLabel="Estado del Project Model"
              onChange={(status) =>
                setModel((current) => ({
                  ...current,
                  status: status as EditableProjectModelInput["status"],
                }))
              }
            >
              <option value="draft">draft</option>
              <option value="generated">generated</option>
              <option value="review_required">review_required</option>
              <option value="approved">approved</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-reason">Motivo del cambio</Label>
            <Textarea
              id="change-reason"
              name="changeReason"
              required
              minLength={3}
              maxLength={1000}
              className="min-h-20"
              placeholder="Ejemplo: se confirmó el alcance del MVP y se ajustaron los riesgos operativos."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Requisitos</CardTitle>
              <CardDescription>
                Capacidades, restricciones y condiciones del producto.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModel((current) => ({
                  ...current,
                  requirements: [
                    ...current.requirements,
                    {
                      id: createId("req"),
                      title: "Nuevo requisito",
                      description: "Describe el requisito.",
                      type: "functional",
                      priority: "should",
                      status: "proposed",
                    },
                  ],
                }))
              }
            >
              Agregar requisito
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {model.requirements.map((requirement, index) => (
            <div key={requirement.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Requisito {index + 1}</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setModel((current) => ({
                      ...current,
                      requirements: current.requirements.filter(
                        (item) => item.id !== requirement.id
                      ),
                    }))
                  }
                >
                  Eliminar
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={requirement.title}
                    onChange={(event) =>
                      setModel((current) => ({
                        ...current,
                        requirements: current.requirements.map((item) =>
                          item.id === requirement.id
                            ? { ...item, title: event.target.value }
                            : item
                        ),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Identificador</Label>
                  <Input value={requirement.id} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={requirement.description}
                  onChange={(event) =>
                    setModel((current) => ({
                      ...current,
                      requirements: current.requirements.map((item) =>
                        item.id === requirement.id
                          ? { ...item, description: event.target.value }
                          : item
                      ),
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <NativeSelect
                  value={requirement.type}
                  ariaLabel="Tipo de requisito"
                  onChange={(type) =>
                    setModel((current) => ({
                      ...current,
                      requirements: current.requirements.map((item) =>
                        item.id === requirement.id
                          ? {
                              ...item,
                              type: type as typeof requirement.type,
                            }
                          : item
                      ),
                    }))
                  }
                >
                  <option value="functional">functional</option>
                  <option value="non_functional">non_functional</option>
                  <option value="security">security</option>
                  <option value="operational">operational</option>
                  <option value="integration">integration</option>
                  <option value="reporting">reporting</option>
                </NativeSelect>

                <NativeSelect
                  value={requirement.priority}
                  ariaLabel="Prioridad del requisito"
                  onChange={(priority) =>
                    setModel((current) => ({
                      ...current,
                      requirements: current.requirements.map((item) =>
                        item.id === requirement.id
                          ? {
                              ...item,
                              priority: priority as typeof requirement.priority,
                            }
                          : item
                      ),
                    }))
                  }
                >
                  <option value="must">must</option>
                  <option value="should">should</option>
                  <option value="could">could</option>
                </NativeSelect>

                <NativeSelect
                  value={requirement.status}
                  ariaLabel="Estado del requisito"
                  onChange={(status) =>
                    setModel((current) => ({
                      ...current,
                      requirements: current.requirements.map((item) =>
                        item.id === requirement.id
                          ? {
                              ...item,
                              status: status as typeof requirement.status,
                            }
                          : item
                      ),
                    }))
                  }
                >
                  {confirmationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Supuestos</CardTitle>
              <CardDescription>
                Inferencias que deben confirmarse o rechazarse.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModel((current) => ({
                  ...current,
                  assumptions: [
                    ...current.assumptions,
                    {
                      id: createId("assumption"),
                      statement: "Nuevo supuesto",
                      impact: "medium",
                      status: "proposed",
                    },
                  ],
                }))
              }
            >
              Agregar supuesto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {model.assumptions.map((assumption, index) => (
            <div key={assumption.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Supuesto {index + 1}</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setModel((current) => ({
                      ...current,
                      assumptions: current.assumptions.filter(
                        (item) => item.id !== assumption.id
                      ),
                    }))
                  }
                >
                  Eliminar
                </Button>
              </div>

              <Textarea
                value={assumption.statement}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    assumptions: current.assumptions.map((item) =>
                      item.id === assumption.id
                        ? { ...item, statement: event.target.value }
                        : item
                    ),
                  }))
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <NativeSelect
                  value={assumption.impact}
                  ariaLabel="Impacto del supuesto"
                  onChange={(impact) =>
                    setModel((current) => ({
                      ...current,
                      assumptions: current.assumptions.map((item) =>
                        item.id === assumption.id
                          ? { ...item, impact: impact as typeof assumption.impact }
                          : item
                      ),
                    }))
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </NativeSelect>

                <NativeSelect
                  value={assumption.status}
                  ariaLabel="Estado del supuesto"
                  onChange={(status) =>
                    setModel((current) => ({
                      ...current,
                      assumptions: current.assumptions.map((item) =>
                        item.id === assumption.id
                          ? { ...item, status: status as typeof assumption.status }
                          : item
                      ),
                    }))
                  }
                >
                  {confirmationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Entidades de dominio</CardTitle>
              <CardDescription>
                Objetos principales y vocabulario del negocio.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModel((current) => ({
                  ...current,
                  domainEntities: [
                    ...current.domainEntities,
                    {
                      id: createId("entity"),
                      name: "Nueva entidad",
                      description: "Describe la entidad.",
                      status: "proposed",
                    },
                  ],
                }))
              }
            >
              Agregar entidad
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {model.domainEntities.map((entity, index) => (
            <div key={entity.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Entidad {index + 1}</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setModel((current) => ({
                      ...current,
                      domainEntities: current.domainEntities.filter(
                        (item) => item.id !== entity.id
                      ),
                    }))
                  }
                >
                  Eliminar
                </Button>
              </div>

              <Input
                value={entity.name}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    domainEntities: current.domainEntities.map((item) =>
                      item.id === entity.id
                        ? { ...item, name: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <Textarea
                value={entity.description}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    domainEntities: current.domainEntities.map((item) =>
                      item.id === entity.id
                        ? { ...item, description: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <NativeSelect
                value={entity.status}
                ariaLabel="Estado de la entidad"
                onChange={(status) =>
                  setModel((current) => ({
                    ...current,
                    domainEntities: current.domainEntities.map((item) =>
                      item.id === entity.id
                        ? { ...item, status: status as typeof entity.status }
                        : item
                    ),
                  }))
                }
              >
                {confirmationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Riesgos</CardTitle>
              <CardDescription>
                Riesgos técnicos, de producto y operativos con mitigación.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModel((current) => ({
                  ...current,
                  risks: [
                    ...current.risks,
                    {
                      id: createId("risk"),
                      title: "Nuevo riesgo",
                      description: "Describe el riesgo.",
                      probability: "medium",
                      impact: "medium",
                      mitigation: "Describe la mitigación.",
                    },
                  ],
                }))
              }
            >
              Agregar riesgo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {model.risks.map((risk, index) => (
            <div key={risk.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Riesgo {index + 1}</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setModel((current) => ({
                      ...current,
                      risks: current.risks.filter((item) => item.id !== risk.id),
                    }))
                  }
                >
                  Eliminar
                </Button>
              </div>

              <Input
                value={risk.title}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    risks: current.risks.map((item) =>
                      item.id === risk.id
                        ? { ...item, title: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <Textarea
                value={risk.description}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    risks: current.risks.map((item) =>
                      item.id === risk.id
                        ? { ...item, description: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <NativeSelect
                  value={risk.probability}
                  ariaLabel="Probabilidad del riesgo"
                  onChange={(probability) =>
                    setModel((current) => ({
                      ...current,
                      risks: current.risks.map((item) =>
                        item.id === risk.id
                          ? { ...item, probability: probability as typeof risk.probability }
                          : item
                      ),
                    }))
                  }
                >
                  <option value="low">low probability</option>
                  <option value="medium">medium probability</option>
                  <option value="high">high probability</option>
                </NativeSelect>
                <NativeSelect
                  value={risk.impact}
                  ariaLabel="Impacto del riesgo"
                  onChange={(impact) =>
                    setModel((current) => ({
                      ...current,
                      risks: current.risks.map((item) =>
                        item.id === risk.id
                          ? { ...item, impact: impact as typeof risk.impact }
                          : item
                      ),
                    }))
                  }
                >
                  <option value="low">low impact</option>
                  <option value="medium">medium impact</option>
                  <option value="high">high impact</option>
                </NativeSelect>
              </div>
              <Textarea
                value={risk.mitigation}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    risks: current.risks.map((item) =>
                      item.id === risk.id
                        ? { ...item, mitigation: event.target.value }
                        : item
                    ),
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Preguntas abiertas</CardTitle>
              <CardDescription>
                Incertidumbres que todavía requieren respuesta.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setModel((current) => ({
                  ...current,
                  openQuestions: [
                    ...current.openQuestions,
                    {
                      id: createId("question"),
                      question: "Nueva pregunta",
                      reason: "Explica por qué debe resolverse.",
                      priority: "medium",
                    },
                  ],
                }))
              }
            >
              Agregar pregunta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {model.openQuestions.map((question, index) => (
            <div key={question.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">Pregunta {index + 1}</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setModel((current) => ({
                      ...current,
                      openQuestions: current.openQuestions.filter(
                        (item) => item.id !== question.id
                      ),
                    }))
                  }
                >
                  Eliminar
                </Button>
              </div>
              <Textarea
                value={question.question}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    openQuestions: current.openQuestions.map((item) =>
                      item.id === question.id
                        ? { ...item, question: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <Textarea
                value={question.reason}
                onChange={(event) =>
                  setModel((current) => ({
                    ...current,
                    openQuestions: current.openQuestions.map((item) =>
                      item.id === question.id
                        ? { ...item, reason: event.target.value }
                        : item
                    ),
                  }))
                }
              />
              <NativeSelect
                value={question.priority}
                ariaLabel="Prioridad de la pregunta"
                onChange={(priority) =>
                  setModel((current) => ({
                    ...current,
                    openQuestions: current.openQuestions.map((item) =>
                      item.id === question.id
                        ? { ...item, priority: priority as typeof question.priority }
                        : item
                    ),
                  }))
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </NativeSelect>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-5">
        <p className="max-w-2xl text-sm text-muted-foreground">
          El guardado será rechazado si no hay diferencias, si un
          campo obligatorio está vacío o si tu rol no permite
          administrar el Project Model.
        </p>
        <SaveButton />
      </div>
    </form>
  );
}
