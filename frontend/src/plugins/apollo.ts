import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core';

// Create Apollo client with simplified configuration
const apolloClient = new ApolloClient({
  link: createHttpLink({
    uri: 'https://api.tarkov.dev/graphql',
    fetchOptions: { timeout: 10000 },
  }),
  cache: new InMemoryCache(),
});

export default apolloClient;
