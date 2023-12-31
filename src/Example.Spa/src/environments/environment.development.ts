export const environment = {
    apiUri: 'https://localhost:7263',
    gitHubUrl: 'https://github.com/ImmersiveFusion/if-opentelemetry-chaos-simulator-sample',
    visualize: (sandboxId: string) => { 

        const facets = [
            {
                key:'Tag: sandbox.id',
                option:sandboxId,
                selected: true,
                filter: `Tags/any(t: t eq 'sandbox.id:${sandboxId}')`
        }];


        const url = 'http://localhost:4200/apm/c39056c8-f40a-4cea-bf3e-e97a0f6b27f6/2075ff0f-2faa-4995-aa06-76648030f440/traces?lastXMinutes=15&queries=&facets=' + btoa(JSON.stringify(facets));
        //const url = 'https://my.immersivefusion.com/apm/c39056c8-f40a-4cea-bf3e-e97a0f6b27f6/2075ff0f-2faa-4995-aa06-76648030f440/traces?lastXMinutes=15&queries=&facets=' + btoa(JSON.stringify(facets));

        window.open(url);
    },
    subscriptionUrl: 'https://immersivefusion.com/pricing'
};
