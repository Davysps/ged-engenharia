import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import { z } from 'zod';
import type { AuthRequest } from '../../middlewares/auth.middleware';

const createOrganizationSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  cnpj: z.string().trim().max(20).optional(),
});

export const listUserOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            nome: true,
            slug: true,
            cnpj: true,
            ativo: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));

    res.status(200).json({ organizations });
  } catch (error) {
    console.error('[Organization] Erro ao listar organizações:', error);
    res.status(500).json({ error: 'Erro ao buscar organizações.' });
  }
};

export const createOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.format() });
      return;
    }

    const { nome, slug, cnpj } = parsed.data;

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      res.status(409).json({ error: 'Este slug já está em uso por outra organização.' });
      return;
    }

    if (cnpj) {
      const existingCnpj = await prisma.organization.findUnique({ where: { cnpj } });
      if (existingCnpj) {
        res.status(409).json({ error: 'Este CNPJ já está cadastrado.' });
        return;
      }
    }

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          nome,
          slug,
          cnpj: cnpj || null,
        },
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: created.id,
          userId,
          role: 'ORG_ADMIN',
        },
      });

      return created;
    });

    res.status(201).json({
      message: 'Organização criada com sucesso.',
      organization: {
        ...org,
        role: 'ORG_ADMIN',
      },
    });
  } catch (error) {
    console.error('[Organization] Erro ao criar organização:', error);
    res.status(500).json({ error: 'Erro ao criar organização.' });
  }
};
