import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  createClientInSupabase,
  createClientCommentInSupabase,
  createProductServiceInSupabase,
  deleteClientInSupabase,
  loadClientCommentsFromSupabase,
  loadSupabaseMasterData,
  updateClientInSupabase,
  updateProductServiceInSupabase,
} from '../data/supabaseRepository';
import {
  ClientUpsertInput,
  CustomerComment,
  MasterClient,
  MasterDataSource,
  MasterProductService,
  ProductServiceUpsertInput,
} from '../domain/types';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

interface MasterDataContextValue {
  clients: MasterClient[];
  productsServices: MasterProductService[];
  source: MasterDataSource;
  loading: boolean;
  warning?: string;
  refresh: () => Promise<{ clients: MasterClient[]; productsServices: MasterProductService[] } | null>;
  getClientById: (clientId?: string) => MasterClient | undefined;
  getClientNameById: (clientId?: string) => string;
  getProductById: (productId?: string) => MasterProductService | undefined;
  createClient: (input: ClientUpsertInput) => Promise<ActionResult<MasterClient>>;
  updateClient: (clientId: string, input: ClientUpsertInput) => Promise<ActionResult<MasterClient>>;
  deleteClient: (clientId: string) => Promise<ActionResult>;
  createProductService: (
    input: ProductServiceUpsertInput,
  ) => Promise<ActionResult<MasterProductService>>;
  updateProductService: (
    productId: string,
    input: ProductServiceUpsertInput,
  ) => Promise<ActionResult<MasterProductService>>;
  getCustomerComments: (clientId: string) => CustomerComment[];
  loadCustomerComments: (clientId: string) => Promise<ActionResult<CustomerComment[]>>;
  addCustomerComment: (clientId: string, body: string) => Promise<ActionResult<CustomerComment>>;
}

const MasterDataContext = createContext<MasterDataContextValue | undefined>(undefined);

function buildSourceData(input: {
  clients: MasterClient[];
  productsServices: MasterProductService[];
  source: MasterDataSource;
  warning?: string;
}) {
  return {
    clients: input.clients,
    productsServices: input.productsServices,
    source: input.source,
    warning: input.warning,
  };
}

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<MasterClient[]>([]);
  const [productsServices, setProductsServices] = useState<MasterProductService[]>([]);
  const [source, setSource] = useState<MasterDataSource>('supabase');
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | undefined>();
  const [customerCommentsByClient, setCustomerCommentsByClient] = useState<Record<string, CustomerComment[]>>({});

  const refresh = async (): Promise<{ clients: MasterClient[]; productsServices: MasterProductService[] } | null> => {
    setLoading(true);
    const result = await loadSupabaseMasterData();
    if (!result.ok) {
      const next = buildSourceData({
        clients,
        productsServices,
        source,
        warning: `Supabase sync failed: ${result.reason}`,
      });
      setClients(next.clients);
      setProductsServices(next.productsServices);
      setSource(next.source);
      setWarning(next.warning);
      setLoading(false);
      return null;
    }

    const next = buildSourceData({
      clients: result.data.clients,
      productsServices: result.data.productsServices,
      source: result.data.source,
      warning: undefined,
    });

    setClients(next.clients);
    setProductsServices(next.productsServices);
    setSource(next.source);
    setWarning(next.warning);
    setLoading(false);
    return { clients: next.clients, productsServices: next.productsServices };
  };

  useEffect(() => {
    void refresh();
  }, []);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const productById = useMemo(
    () => new Map(productsServices.map((product) => [product.id, product])),
    [productsServices],
  );

  const value: MasterDataContextValue = {
    clients,
    productsServices,
    source,
    loading,
    warning,
    refresh,
    getClientById: (clientId) => {
      if (!clientId) return undefined;
      return clientById.get(clientId);
    },
    getClientNameById: (clientId) => {
      if (!clientId) return 'Unknown client';
      return clientById.get(clientId)?.name ?? clientId;
    },
    getProductById: (productId) => {
      if (!productId) return undefined;
      return productById.get(productId);
    },
    createClient: async (input) => {
      const result = await createClientInSupabase(input);
      if (!result.ok) return { ok: false, error: result.reason };
      const reloaded = await refresh();
      const created = reloaded?.clients.find((client) => client.id === result.id);
      return created
        ? { ok: true, data: created }
        : { ok: false, error: 'Client created but could not be reloaded.' };
    },
    updateClient: async (clientId, input) => {
      const result = await updateClientInSupabase(clientId, input);
      if (!result.ok) return { ok: false, error: result.reason };
      const reloaded = await refresh();
      const updated = reloaded?.clients.find((client) => client.id === clientId);
      return updated
        ? { ok: true, data: updated }
        : { ok: false, error: 'Client updated but could not be reloaded.' };
    },
    deleteClient: async (clientId) => {
      const result = await deleteClientInSupabase(clientId);
      if (!result.ok) return { ok: false, error: result.reason };
      await refresh();
      setCustomerCommentsByClient((previous) => {
        const next = { ...previous };
        delete next[clientId];
        return next;
      });
      return { ok: true };
    },
    createProductService: async (input) => {
      const result = await createProductServiceInSupabase(input);
      if (!result.ok) return { ok: false, error: result.reason };
      const reloaded = await refresh();
      const created = reloaded?.productsServices.find((product) => product.id === result.id);
      return created
        ? { ok: true, data: created }
        : { ok: false, error: 'Product/service created but could not be reloaded.' };
    },
    updateProductService: async (productId, input) => {
      const result = await updateProductServiceInSupabase(productId, input);
      if (!result.ok) return { ok: false, error: result.reason };
      const reloaded = await refresh();
      const updated = reloaded?.productsServices.find((product) => product.id === productId);
      return updated
        ? { ok: true, data: updated }
        : { ok: false, error: 'Product/service updated but could not be reloaded.' };
    },
    getCustomerComments: (clientId) => customerCommentsByClient[clientId] ?? [],
    loadCustomerComments: async (clientId) => {
      const result = await loadClientCommentsFromSupabase(clientId);
      if (!result.ok) return { ok: false, error: result.reason };
      setCustomerCommentsByClient((previous) => ({ ...previous, [clientId]: result.data }));
      return { ok: true, data: result.data };
    },
    addCustomerComment: async (clientId, body) => {
      const trimmedBody = body.trim();
      if (!trimmedBody) return { ok: false, error: 'Comment body is required.' };

      const createResult = await createClientCommentInSupabase({ clientId, body: trimmedBody });
      if (!createResult.ok) return { ok: false, error: createResult.reason };

      const reloadResult = await loadClientCommentsFromSupabase(clientId);
      if (!reloadResult.ok) return { ok: false, error: reloadResult.reason };

      setCustomerCommentsByClient((previous) => ({ ...previous, [clientId]: reloadResult.data }));
      const created = reloadResult.data.find((comment) => comment.id === createResult.id);
      return created
        ? { ok: true, data: created }
        : { ok: false, error: 'Comment created but could not be reloaded.' };
    },
  };

  return <MasterDataContext.Provider value={value}>{children}</MasterDataContext.Provider>;
}

export function useMasterDataContext(): MasterDataContextValue {
  const context = useContext(MasterDataContext);
  if (!context) {
    throw new Error('useMasterDataContext must be used within MasterDataProvider.');
  }
  return context;
}
