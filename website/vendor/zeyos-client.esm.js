// ../../../zeyos/client/src/generated/operations.js
var GENERATED = {
  "generatedAt": null,
  "services": {
    "api": {
      "key": "api",
      "source": "openapi/api.json",
      "title": "ZeyOS Standard REST API",
      "version": "v1",
      "server": {
        "urlTemplate": "https://cloud.zeyos.com/{INSTANCE}/api/v1",
        "basePathTemplate": "/{INSTANCE}/api/v1",
        "defaultVariables": {
          "INSTANCE": "demo"
        }
      },
      "globalSecurity": [
        {
          "oauth": []
        },
        {
          "session": []
        }
      ],
      "operations": [
        {
          "operationId": "listAccounts",
          "summary": "List accounts",
          "deprecated": false,
          "method": "POST",
          "path": "/accounts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createAccount",
          "summary": "Create new account",
          "deprecated": false,
          "method": "PUT",
          "path": "/accounts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteAccount",
          "summary": "Delete account",
          "deprecated": false,
          "method": "DELETE",
          "path": "/accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getAccount",
          "summary": "Get account",
          "deprecated": false,
          "method": "GET",
          "path": "/accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsAccount",
          "summary": "Check if account exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateAccount",
          "summary": "Update existing account",
          "deprecated": false,
          "method": "PATCH",
          "path": "/accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listActionSteps",
          "summary": "List actionsteps",
          "deprecated": false,
          "method": "POST",
          "path": "/actionsteps",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createActionStep",
          "summary": "Create new action step",
          "deprecated": false,
          "method": "PUT",
          "path": "/actionsteps",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteActionStep",
          "summary": "Delete action step",
          "deprecated": false,
          "method": "DELETE",
          "path": "/actionsteps/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getActionStep",
          "summary": "Get action step",
          "deprecated": false,
          "method": "GET",
          "path": "/actionsteps/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsActionStep",
          "summary": "Check if action step exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/actionsteps/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateActionStep",
          "summary": "Update existing action step",
          "deprecated": false,
          "method": "PATCH",
          "path": "/actionsteps/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listAddresses",
          "summary": "List addresses",
          "deprecated": false,
          "method": "POST",
          "path": "/addresses",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createAddress",
          "summary": "Create new address",
          "deprecated": false,
          "method": "PUT",
          "path": "/addresses",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteAddress",
          "summary": "Delete address",
          "deprecated": false,
          "method": "DELETE",
          "path": "/addresses/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getAddress",
          "summary": "Get address",
          "deprecated": false,
          "method": "GET",
          "path": "/addresses/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsAddress",
          "summary": "Check if address exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/addresses/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateAddress",
          "summary": "Update existing address",
          "deprecated": false,
          "method": "PATCH",
          "path": "/addresses/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listApplicationAssets",
          "summary": "List application assets",
          "deprecated": false,
          "method": "POST",
          "path": "/applicationassets",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getApplicationAsset",
          "summary": "Get application asset",
          "deprecated": false,
          "method": "GET",
          "path": "/applicationassets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsApplicationAsset",
          "summary": "Check if application asset exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/applicationassets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listApplications",
          "summary": "List applications",
          "deprecated": false,
          "method": "POST",
          "path": "/applications",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getApplication",
          "summary": "Get application",
          "deprecated": false,
          "method": "GET",
          "path": "/applications/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsApplication",
          "summary": "Check if application exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/applications/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listAppointments",
          "summary": "List appointments",
          "deprecated": false,
          "method": "POST",
          "path": "/appointments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createAppointment",
          "summary": "Create new appointment",
          "deprecated": false,
          "method": "PUT",
          "path": "/appointments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteAppointment",
          "summary": "Delete appointment",
          "deprecated": false,
          "method": "DELETE",
          "path": "/appointments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getAppointment",
          "summary": "Get appointment",
          "deprecated": false,
          "method": "GET",
          "path": "/appointments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsAppointment",
          "summary": "Check if appointment exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/appointments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateAppointment",
          "summary": "Update existing appointment",
          "deprecated": false,
          "method": "PATCH",
          "path": "/appointments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listAssociations",
          "summary": "List associations",
          "deprecated": false,
          "method": "POST",
          "path": "/associations",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createAssociation",
          "summary": "Create new association",
          "deprecated": false,
          "method": "PUT",
          "path": "/associations",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteAssociation",
          "summary": "Delete association",
          "deprecated": false,
          "method": "DELETE",
          "path": "/associations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getAssociation",
          "summary": "Get association",
          "deprecated": false,
          "method": "GET",
          "path": "/associations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsAssociation",
          "summary": "Check if association exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/associations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateAssociation",
          "summary": "Update existing association",
          "deprecated": false,
          "method": "PATCH",
          "path": "/associations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listBinFiles",
          "summary": "List bin files",
          "deprecated": false,
          "method": "POST",
          "path": "/binfiles",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "listCampaigns",
          "summary": "List campaigns",
          "deprecated": false,
          "method": "POST",
          "path": "/campaigns",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createCampaign",
          "summary": "Create new campaign",
          "deprecated": false,
          "method": "PUT",
          "path": "/campaigns",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteCampaign",
          "summary": "Delete campaign",
          "deprecated": false,
          "method": "DELETE",
          "path": "/campaigns/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getCampaign",
          "summary": "Get campaign",
          "deprecated": false,
          "method": "GET",
          "path": "/campaigns/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsCampaign",
          "summary": "Check if campaign exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/campaigns/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateCampaign",
          "summary": "Update existing campaign",
          "deprecated": false,
          "method": "PATCH",
          "path": "/campaigns/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listCategorys",
          "summary": "List categories",
          "deprecated": false,
          "method": "POST",
          "path": "/categories",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createCategory",
          "summary": "Create new category",
          "deprecated": false,
          "method": "PUT",
          "path": "/categories",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteCategory",
          "summary": "Delete category",
          "deprecated": false,
          "method": "DELETE",
          "path": "/categories/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getCategory",
          "summary": "Get category",
          "deprecated": false,
          "method": "GET",
          "path": "/categories/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsCategory",
          "summary": "Check if category exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/categories/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateCategory",
          "summary": "Update existing category",
          "deprecated": false,
          "method": "PATCH",
          "path": "/categories/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listChannels",
          "summary": "List channels",
          "deprecated": false,
          "method": "POST",
          "path": "/channels",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createChannel",
          "summary": "Create new channel",
          "deprecated": false,
          "method": "PUT",
          "path": "/channels",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteChannel",
          "summary": "Delete channel",
          "deprecated": false,
          "method": "DELETE",
          "path": "/channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getChannel",
          "summary": "Get channel",
          "deprecated": false,
          "method": "GET",
          "path": "/channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsChannel",
          "summary": "Check if channel exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateChannel",
          "summary": "Update existing channel",
          "deprecated": false,
          "method": "PATCH",
          "path": "/channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listComments",
          "summary": "List comments",
          "deprecated": false,
          "method": "POST",
          "path": "/comments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createComment",
          "summary": "Create new comment",
          "deprecated": false,
          "method": "PUT",
          "path": "/comments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteComment",
          "summary": "Delete comment",
          "deprecated": false,
          "method": "DELETE",
          "path": "/comments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getComment",
          "summary": "Get comment",
          "deprecated": false,
          "method": "GET",
          "path": "/comments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsComment",
          "summary": "Check if comment exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/comments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateComment",
          "summary": "Update existing comment",
          "deprecated": false,
          "method": "PATCH",
          "path": "/comments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listComponents",
          "summary": "List components",
          "deprecated": false,
          "method": "POST",
          "path": "/components",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createComponent",
          "summary": "Create new component",
          "deprecated": false,
          "method": "PUT",
          "path": "/components",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteComponent",
          "summary": "Delete component",
          "deprecated": false,
          "method": "DELETE",
          "path": "/components/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getComponent",
          "summary": "Get component",
          "deprecated": false,
          "method": "GET",
          "path": "/components/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsComponent",
          "summary": "Check if component exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/components/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateComponent",
          "summary": "Update existing component",
          "deprecated": false,
          "method": "PATCH",
          "path": "/components/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getConfig",
          "summary": "Get system configuration",
          "deprecated": false,
          "method": "GET",
          "path": "/config",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "listContacts",
          "summary": "List contacts",
          "deprecated": false,
          "method": "POST",
          "path": "/contacts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createContact",
          "summary": "Create new contact",
          "deprecated": false,
          "method": "PUT",
          "path": "/contacts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteContact",
          "summary": "Delete contact",
          "deprecated": false,
          "method": "DELETE",
          "path": "/contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getContact",
          "summary": "Get contact",
          "deprecated": false,
          "method": "GET",
          "path": "/contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsContact",
          "summary": "Check if contact exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateContact",
          "summary": "Update existing contact",
          "deprecated": false,
          "method": "PATCH",
          "path": "/contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listContactsToContacts",
          "summary": "List contacts-to-contacts",
          "deprecated": false,
          "method": "POST",
          "path": "/contacts2contacts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createContactToContact",
          "summary": "Create new contact-to-contact",
          "deprecated": false,
          "method": "PUT",
          "path": "/contacts2contacts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteContactToContact",
          "summary": "Delete contact-to-contact",
          "deprecated": false,
          "method": "DELETE",
          "path": "/contacts2contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getContactToContact",
          "summary": "Get contact-to-contact",
          "deprecated": false,
          "method": "GET",
          "path": "/contacts2contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsContactToContact",
          "summary": "Check if contact-to-contact exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/contacts2contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateContactToContact",
          "summary": "Update existing contact-to-contact",
          "deprecated": false,
          "method": "PATCH",
          "path": "/contacts2contacts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listContracts",
          "summary": "List contracts",
          "deprecated": false,
          "method": "POST",
          "path": "/contracts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createContract",
          "summary": "Create new contract",
          "deprecated": false,
          "method": "PUT",
          "path": "/contracts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteContract",
          "summary": "Delete contract",
          "deprecated": false,
          "method": "DELETE",
          "path": "/contracts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getContract",
          "summary": "Get contract",
          "deprecated": false,
          "method": "GET",
          "path": "/contracts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsContract",
          "summary": "Check if contract exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/contracts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateContract",
          "summary": "Update existing contract",
          "deprecated": false,
          "method": "PATCH",
          "path": "/contracts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listCouponCodes",
          "summary": "List coupon codes",
          "deprecated": false,
          "method": "POST",
          "path": "/couponcodes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createCouponCode",
          "summary": "Create new coupon code",
          "deprecated": false,
          "method": "PUT",
          "path": "/couponcodes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteCouponCode",
          "summary": "Delete coupon code",
          "deprecated": false,
          "method": "DELETE",
          "path": "/couponcodes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getCouponCode",
          "summary": "Get coupon code",
          "deprecated": false,
          "method": "GET",
          "path": "/couponcodes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsCouponCode",
          "summary": "Check if coupon code exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/couponcodes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateCouponCode",
          "summary": "Update existing coupon code",
          "deprecated": false,
          "method": "PATCH",
          "path": "/couponcodes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listCoupons",
          "summary": "List coupons",
          "deprecated": false,
          "method": "POST",
          "path": "/coupons",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createCoupon",
          "summary": "Create new coupon",
          "deprecated": false,
          "method": "PUT",
          "path": "/coupons",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteCoupon",
          "summary": "Delete coupon",
          "deprecated": false,
          "method": "DELETE",
          "path": "/coupons/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getCoupon",
          "summary": "Get coupon",
          "deprecated": false,
          "method": "GET",
          "path": "/coupons/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsCoupon",
          "summary": "Check if coupon exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/coupons/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateCoupon",
          "summary": "Update existing coupon",
          "deprecated": false,
          "method": "PATCH",
          "path": "/coupons/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listCustomFields",
          "summary": "List custom fields",
          "deprecated": false,
          "method": "POST",
          "path": "/customfields",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getCustomField",
          "summary": "Get custom field",
          "deprecated": false,
          "method": "GET",
          "path": "/customfields/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsCustomField",
          "summary": "Check if custom field exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/customfields/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listDAVServers",
          "summary": "List DAV servers",
          "deprecated": false,
          "method": "POST",
          "path": "/davservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createDAVServer",
          "summary": "Create new DAV server",
          "deprecated": false,
          "method": "PUT",
          "path": "/davservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteDAVServer",
          "summary": "Delete DAV server",
          "deprecated": false,
          "method": "DELETE",
          "path": "/davservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getDAVServer",
          "summary": "Get DAV server",
          "deprecated": false,
          "method": "GET",
          "path": "/davservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsDAVServer",
          "summary": "Check if DAV server exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/davservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateDAVServer",
          "summary": "Update existing DAV server",
          "deprecated": false,
          "method": "PATCH",
          "path": "/davservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listDevices",
          "summary": "List devices",
          "deprecated": false,
          "method": "POST",
          "path": "/devices",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createDevice",
          "summary": "Create new device",
          "deprecated": false,
          "method": "PUT",
          "path": "/devices",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteDevice",
          "summary": "Delete device",
          "deprecated": false,
          "method": "DELETE",
          "path": "/devices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getDevice",
          "summary": "Get device",
          "deprecated": false,
          "method": "GET",
          "path": "/devices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsDevice",
          "summary": "Check if device exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/devices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateDevice",
          "summary": "Update existing device",
          "deprecated": false,
          "method": "PATCH",
          "path": "/devices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listDocuments",
          "summary": "List documents",
          "deprecated": false,
          "method": "POST",
          "path": "/documents",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createDocument",
          "summary": "Create new document",
          "deprecated": false,
          "method": "PUT",
          "path": "/documents",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteDocument",
          "summary": "Delete document",
          "deprecated": false,
          "method": "DELETE",
          "path": "/documents/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getDocument",
          "summary": "Get document",
          "deprecated": false,
          "method": "GET",
          "path": "/documents/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsDocument",
          "summary": "Check if document exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/documents/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateDocument",
          "summary": "Update existing document",
          "deprecated": false,
          "method": "PATCH",
          "path": "/documents/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listDunningNotices",
          "summary": "List dunning notices",
          "deprecated": false,
          "method": "POST",
          "path": "/dunning",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createDunningNotice",
          "summary": "Create new dunning notice",
          "deprecated": false,
          "method": "PUT",
          "path": "/dunning",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteDunningNotice",
          "summary": "Delete dunning notice",
          "deprecated": false,
          "method": "DELETE",
          "path": "/dunning/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getDunningNotice",
          "summary": "Get dunning notice",
          "deprecated": false,
          "method": "GET",
          "path": "/dunning/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsDunningNotice",
          "summary": "Check if dunning notice exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/dunning/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateDunningNotice",
          "summary": "Update existing dunning notice",
          "deprecated": false,
          "method": "PATCH",
          "path": "/dunning/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listDunningToTransactions",
          "summary": "List dunning-to-transactions",
          "deprecated": false,
          "method": "POST",
          "path": "/dunning2transactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createDunningToTransaction",
          "summary": "Create new dunning-to-transaction",
          "deprecated": false,
          "method": "PUT",
          "path": "/dunning2transactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteDunningToTransaction",
          "summary": "Delete dunning-to-transaction",
          "deprecated": false,
          "method": "DELETE",
          "path": "/dunning2transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getDunningToTransaction",
          "summary": "Get dunning-to-transaction",
          "deprecated": false,
          "method": "GET",
          "path": "/dunning2transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsDunningToTransaction",
          "summary": "Check if dunning-to-transaction exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/dunning2transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateDunningToTransaction",
          "summary": "Update existing dunning-to-transaction",
          "deprecated": false,
          "method": "PATCH",
          "path": "/dunning2transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listEntitiesToChannels",
          "summary": "List entities-to-channels",
          "deprecated": false,
          "method": "POST",
          "path": "/entities2channels",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createEntityToChannel",
          "summary": "Create new entity-to-channel",
          "deprecated": false,
          "method": "PUT",
          "path": "/entities2channels",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteEntityToChannel",
          "summary": "Delete entity-to-channel",
          "deprecated": false,
          "method": "DELETE",
          "path": "/entities2channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getEntityToChannel",
          "summary": "Get entity-to-channel",
          "deprecated": false,
          "method": "GET",
          "path": "/entities2channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsEntityToChannel",
          "summary": "Check if entity-to-channel exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/entities2channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateEntityToChannel",
          "summary": "Update existing entity-to-channel",
          "deprecated": false,
          "method": "PATCH",
          "path": "/entities2channels/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listEvents",
          "summary": "List events",
          "deprecated": false,
          "method": "POST",
          "path": "/events",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createEvent",
          "summary": "Create new event",
          "deprecated": false,
          "method": "PUT",
          "path": "/events",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteEvent",
          "summary": "Delete event",
          "deprecated": false,
          "method": "DELETE",
          "path": "/events/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getEvent",
          "summary": "Get event",
          "deprecated": false,
          "method": "GET",
          "path": "/events/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsEvent",
          "summary": "Check if event exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/events/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateEvent",
          "summary": "Update existing event",
          "deprecated": false,
          "method": "PATCH",
          "path": "/events/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listFeedServers",
          "summary": "List feed servers",
          "deprecated": false,
          "method": "POST",
          "path": "/feedservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createFeedServer",
          "summary": "Create new feed server",
          "deprecated": false,
          "method": "PUT",
          "path": "/feedservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteFeedServer",
          "summary": "Delete feed server",
          "deprecated": false,
          "method": "DELETE",
          "path": "/feedservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getFeedServer",
          "summary": "Get feed server",
          "deprecated": false,
          "method": "GET",
          "path": "/feedservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsFeedServer",
          "summary": "Check if feed server exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/feedservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateFeedServer",
          "summary": "Update existing feed server",
          "deprecated": false,
          "method": "PATCH",
          "path": "/feedservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listFiles",
          "summary": "List files",
          "deprecated": false,
          "method": "POST",
          "path": "/files",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createFile",
          "summary": "Create new file",
          "deprecated": false,
          "method": "PUT",
          "path": "/files",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteFile",
          "summary": "Delete file",
          "deprecated": false,
          "method": "DELETE",
          "path": "/files/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getFile",
          "summary": "Get file",
          "deprecated": false,
          "method": "GET",
          "path": "/files/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsFile",
          "summary": "Check if file exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/files/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateFile",
          "summary": "Update existing file",
          "deprecated": false,
          "method": "PATCH",
          "path": "/files/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listFollows",
          "summary": "List follows",
          "deprecated": false,
          "method": "POST",
          "path": "/follows",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createFollow",
          "summary": "Create new follow",
          "deprecated": false,
          "method": "PUT",
          "path": "/follows",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteFollow",
          "summary": "Delete follow",
          "deprecated": false,
          "method": "DELETE",
          "path": "/follows/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getFollow",
          "summary": "Get follow",
          "deprecated": false,
          "method": "GET",
          "path": "/follows/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsFollow",
          "summary": "Check if follow exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/follows/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateFollow",
          "summary": "Update existing follow",
          "deprecated": false,
          "method": "PATCH",
          "path": "/follows/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listForks",
          "summary": "List forks",
          "deprecated": false,
          "method": "POST",
          "path": "/forks",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getFork",
          "summary": "Get fork",
          "deprecated": false,
          "method": "GET",
          "path": "/forks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsFork",
          "summary": "Check if fork exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/forks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listGroups",
          "summary": "List groups",
          "deprecated": false,
          "method": "POST",
          "path": "/groups",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getGroup",
          "summary": "Get group",
          "deprecated": false,
          "method": "GET",
          "path": "/groups/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsGroup",
          "summary": "Check if group exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/groups/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listGroupsToUsers",
          "summary": "List groups-to-users",
          "deprecated": false,
          "method": "POST",
          "path": "/groups2users",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getGroupToUser",
          "summary": "Get group-to-user",
          "deprecated": false,
          "method": "GET",
          "path": "/groups2users/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsGroupToUser",
          "summary": "Check if group-to-user exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/groups2users/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listInvitations",
          "summary": "List invitations",
          "deprecated": false,
          "method": "POST",
          "path": "/invitations",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createInvitation",
          "summary": "Create new invitation",
          "deprecated": false,
          "method": "PUT",
          "path": "/invitations",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteInvitation",
          "summary": "Delete invitation",
          "deprecated": false,
          "method": "DELETE",
          "path": "/invitations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getInvitation",
          "summary": "Get invitation",
          "deprecated": false,
          "method": "GET",
          "path": "/invitations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsInvitation",
          "summary": "Check if invitation exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/invitations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateInvitation",
          "summary": "Update existing invitation",
          "deprecated": false,
          "method": "PATCH",
          "path": "/invitations/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listItems",
          "summary": "List items",
          "deprecated": false,
          "method": "POST",
          "path": "/items",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createItem",
          "summary": "Create new item",
          "deprecated": false,
          "method": "PUT",
          "path": "/items",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteItem",
          "summary": "Delete item",
          "deprecated": false,
          "method": "DELETE",
          "path": "/items/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getItem",
          "summary": "Get item",
          "deprecated": false,
          "method": "GET",
          "path": "/items/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsItem",
          "summary": "Check if item exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/items/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateItem",
          "summary": "Update existing item",
          "deprecated": false,
          "method": "PATCH",
          "path": "/items/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listLedgers",
          "summary": "List ledgers",
          "deprecated": false,
          "method": "POST",
          "path": "/ledgers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createLedger",
          "summary": "Create new ledger",
          "deprecated": false,
          "method": "PUT",
          "path": "/ledgers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteLedger",
          "summary": "Delete ledger",
          "deprecated": false,
          "method": "DELETE",
          "path": "/ledgers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getLedger",
          "summary": "Get ledger",
          "deprecated": false,
          "method": "GET",
          "path": "/ledgers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsLedger",
          "summary": "Check if ledger exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/ledgers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateLedger",
          "summary": "Update existing ledger",
          "deprecated": false,
          "method": "PATCH",
          "path": "/ledgers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listLikes",
          "summary": "List likes",
          "deprecated": false,
          "method": "POST",
          "path": "/likes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createLike",
          "summary": "Create new like",
          "deprecated": false,
          "method": "PUT",
          "path": "/likes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteLike",
          "summary": "Delete like",
          "deprecated": false,
          "method": "DELETE",
          "path": "/likes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getLike",
          "summary": "Get like",
          "deprecated": false,
          "method": "GET",
          "path": "/likes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsLike",
          "summary": "Check if like exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/likes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateLike",
          "summary": "Update existing like",
          "deprecated": false,
          "method": "PATCH",
          "path": "/likes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listLinks",
          "summary": "List links",
          "deprecated": false,
          "method": "POST",
          "path": "/links",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createLink",
          "summary": "Create new link",
          "deprecated": false,
          "method": "PUT",
          "path": "/links",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteLink",
          "summary": "Delete link",
          "deprecated": false,
          "method": "DELETE",
          "path": "/links/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getLink",
          "summary": "Get link",
          "deprecated": false,
          "method": "GET",
          "path": "/links/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsLink",
          "summary": "Check if link exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/links/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateLink",
          "summary": "Update existing link",
          "deprecated": false,
          "method": "PATCH",
          "path": "/links/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listMailingLists",
          "summary": "List mailing lists",
          "deprecated": false,
          "method": "POST",
          "path": "/mailinglists",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createMailingList",
          "summary": "Create new mailing list",
          "deprecated": false,
          "method": "PUT",
          "path": "/mailinglists",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteMailingList",
          "summary": "Delete mailing list",
          "deprecated": false,
          "method": "DELETE",
          "path": "/mailinglists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getMailingList",
          "summary": "Get mailing list",
          "deprecated": false,
          "method": "GET",
          "path": "/mailinglists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsMailingList",
          "summary": "Check if mailing list exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/mailinglists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateMailingList",
          "summary": "Update existing mailing list",
          "deprecated": false,
          "method": "PATCH",
          "path": "/mailinglists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listMailingRecipients",
          "summary": "List mailing recipients",
          "deprecated": false,
          "method": "POST",
          "path": "/mailingrecipients",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createMailingRecipient",
          "summary": "Create new mailing recipient",
          "deprecated": false,
          "method": "PUT",
          "path": "/mailingrecipients",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteMailingRecipient",
          "summary": "Delete mailing recipient",
          "deprecated": false,
          "method": "DELETE",
          "path": "/mailingrecipients/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getMailingRecipient",
          "summary": "Get mailing recipient",
          "deprecated": false,
          "method": "GET",
          "path": "/mailingrecipients/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsMailingRecipients",
          "summary": "Check if mailing recipient exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/mailingrecipients/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateMailingRecipient",
          "summary": "Update existing mailing recipient",
          "deprecated": false,
          "method": "PATCH",
          "path": "/mailingrecipients/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listMailServers",
          "summary": "List mail servers",
          "deprecated": false,
          "method": "POST",
          "path": "/mailservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createMailServer",
          "summary": "Create new mail server",
          "deprecated": false,
          "method": "PUT",
          "path": "/mailservers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteMailServer",
          "summary": "Delete mail server",
          "deprecated": false,
          "method": "DELETE",
          "path": "/mailservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getMailServer",
          "summary": "Get mail server",
          "deprecated": false,
          "method": "GET",
          "path": "/mailservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsMailServer",
          "summary": "Check if mail server exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/mailservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateMailServer",
          "summary": "Update existing mail server",
          "deprecated": false,
          "method": "PATCH",
          "path": "/mailservers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listMessageReads",
          "summary": "List message-reads",
          "deprecated": false,
          "method": "POST",
          "path": "/messagereads",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createMessageRead",
          "summary": "Create new message-read",
          "deprecated": false,
          "method": "PUT",
          "path": "/messagereads",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteMessageRead",
          "summary": "Delete message-read",
          "deprecated": false,
          "method": "DELETE",
          "path": "/messagereads/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getMessageRead",
          "summary": "Get message-read",
          "deprecated": false,
          "method": "GET",
          "path": "/messagereads/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsMessageRead",
          "summary": "Check if message-read exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/messagereads/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateMessageRead",
          "summary": "Update existing message-read",
          "deprecated": false,
          "method": "PATCH",
          "path": "/messagereads/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listMessages",
          "summary": "List messages",
          "deprecated": false,
          "method": "POST",
          "path": "/messages",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createMessage",
          "summary": "Create new message",
          "deprecated": false,
          "method": "PUT",
          "path": "/messages",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteMessage",
          "summary": "Delete message",
          "deprecated": false,
          "method": "DELETE",
          "path": "/messages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getMessage",
          "summary": "Get message",
          "deprecated": false,
          "method": "GET",
          "path": "/messages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsMessage",
          "summary": "Check if message exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/messages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateMessage",
          "summary": "Update existing message",
          "deprecated": false,
          "method": "PATCH",
          "path": "/messages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listNotes",
          "summary": "List notes",
          "deprecated": false,
          "method": "POST",
          "path": "/notes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createNote",
          "summary": "Create new note",
          "deprecated": false,
          "method": "PUT",
          "path": "/notes",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteNote",
          "summary": "Delete note",
          "deprecated": false,
          "method": "DELETE",
          "path": "/notes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getNote",
          "summary": "Get note",
          "deprecated": false,
          "method": "GET",
          "path": "/notes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsNote",
          "summary": "Check if note exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/notes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateNote",
          "summary": "Update existing note",
          "deprecated": false,
          "method": "PATCH",
          "path": "/notes/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listObjects",
          "summary": "List custom objects",
          "deprecated": false,
          "method": "POST",
          "path": "/objects",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createObject",
          "summary": "Create new custom object",
          "deprecated": false,
          "method": "PUT",
          "path": "/objects",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteObject",
          "summary": "Delete custom object",
          "deprecated": false,
          "method": "DELETE",
          "path": "/objects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getObject",
          "summary": "Get custom object",
          "deprecated": false,
          "method": "GET",
          "path": "/objects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsObject",
          "summary": "Check if custom object exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/objects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateObject",
          "summary": "Update existing custom object",
          "deprecated": false,
          "method": "PATCH",
          "path": "/objects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listOpportunities",
          "summary": "List opportunities",
          "deprecated": false,
          "method": "POST",
          "path": "/opportunities",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createOpportunity",
          "summary": "Create new opportunity",
          "deprecated": false,
          "method": "PUT",
          "path": "/opportunities",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteOpportunity",
          "summary": "Delete opportunity",
          "deprecated": false,
          "method": "DELETE",
          "path": "/opportunities/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getOpportunity",
          "summary": "Get opportunity",
          "deprecated": false,
          "method": "GET",
          "path": "/opportunities/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsOpportunity",
          "summary": "Check if opportunity exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/opportunities/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateOpportunity",
          "summary": "Update existing opportunity",
          "deprecated": false,
          "method": "PATCH",
          "path": "/opportunities/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listParticipants",
          "summary": "List participants",
          "deprecated": false,
          "method": "POST",
          "path": "/participants",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createParticipant",
          "summary": "Create new participant",
          "deprecated": false,
          "method": "PUT",
          "path": "/participants",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteParticipant",
          "summary": "Delete participant",
          "deprecated": false,
          "method": "DELETE",
          "path": "/participants/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getParticipant",
          "summary": "Get participant",
          "deprecated": false,
          "method": "GET",
          "path": "/participants/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsParticipant",
          "summary": "Check if participant exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/participants/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateParticipant",
          "summary": "Update existing participant",
          "deprecated": false,
          "method": "PATCH",
          "path": "/participants/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listPayments",
          "summary": "List payments",
          "deprecated": false,
          "method": "POST",
          "path": "/payments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createPayment",
          "summary": "Create new payment",
          "deprecated": false,
          "method": "PUT",
          "path": "/payments",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deletePayment",
          "summary": "Delete payment",
          "deprecated": false,
          "method": "DELETE",
          "path": "/payments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getPayment",
          "summary": "Get payment",
          "deprecated": false,
          "method": "GET",
          "path": "/payments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsPayment",
          "summary": "Check if payment exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/payments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updatePayment",
          "summary": "Update existing payment",
          "deprecated": false,
          "method": "PATCH",
          "path": "/payments/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listPermissions",
          "summary": "List permissions",
          "deprecated": false,
          "method": "POST",
          "path": "/permissions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getPermission",
          "summary": "Get permission",
          "deprecated": false,
          "method": "GET",
          "path": "/permissions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsPermission",
          "summary": "Check if permission exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/permissions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listPriceLists",
          "summary": "List price lists",
          "deprecated": false,
          "method": "POST",
          "path": "/pricelists",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createPriceList",
          "summary": "Create new price list",
          "deprecated": false,
          "method": "PUT",
          "path": "/pricelists",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deletePriceList",
          "summary": "Delete price list",
          "deprecated": false,
          "method": "DELETE",
          "path": "/pricelists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getPriceList",
          "summary": "Get price list",
          "deprecated": false,
          "method": "GET",
          "path": "/pricelists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsPriceList",
          "summary": "Check if price list exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/pricelists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updatePriceList",
          "summary": "Update existing price list",
          "deprecated": false,
          "method": "PATCH",
          "path": "/pricelists/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listPriceListsToAccounts",
          "summary": "List pricelists-to-accounts",
          "deprecated": false,
          "method": "POST",
          "path": "/pricelists2accounts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createPriceListToAccount",
          "summary": "Create new price",
          "deprecated": false,
          "method": "PUT",
          "path": "/pricelists2accounts",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deletePriceListToAccount",
          "summary": "Delete price",
          "deprecated": false,
          "method": "DELETE",
          "path": "/pricelists2accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getPriceListToAccount",
          "summary": "Get price",
          "deprecated": false,
          "method": "GET",
          "path": "/pricelists2accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsPriceListToAccount",
          "summary": "Check if price exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/pricelists2accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updatePriceListToAccount",
          "summary": "Update existing price",
          "deprecated": false,
          "method": "PATCH",
          "path": "/pricelists2accounts/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listPrices",
          "summary": "List prices",
          "deprecated": false,
          "method": "POST",
          "path": "/prices",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createPrice",
          "summary": "Create new price",
          "deprecated": false,
          "method": "PUT",
          "path": "/prices",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deletePrice",
          "summary": "Delete price",
          "deprecated": false,
          "method": "DELETE",
          "path": "/prices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getPrice",
          "summary": "Get price",
          "deprecated": false,
          "method": "GET",
          "path": "/prices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsPrice",
          "summary": "Check if price exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/prices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updatePrice",
          "summary": "Update existing price",
          "deprecated": false,
          "method": "PATCH",
          "path": "/prices/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listProjects",
          "summary": "List projects",
          "deprecated": false,
          "method": "POST",
          "path": "/projects",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createProject",
          "summary": "Create new project",
          "deprecated": false,
          "method": "PUT",
          "path": "/projects",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteProject",
          "summary": "Delete project",
          "deprecated": false,
          "method": "DELETE",
          "path": "/projects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getProject",
          "summary": "Get project",
          "deprecated": false,
          "method": "GET",
          "path": "/projects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsProject",
          "summary": "Check if project exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/projects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateProject",
          "summary": "Update existing project",
          "deprecated": false,
          "method": "PATCH",
          "path": "/projects/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listRecords",
          "summary": "List records",
          "deprecated": false,
          "method": "POST",
          "path": "/records",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createRecord",
          "summary": "Create new record",
          "deprecated": false,
          "method": "PUT",
          "path": "/records",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteRecord",
          "summary": "Delete record",
          "deprecated": false,
          "method": "DELETE",
          "path": "/records/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getRecord",
          "summary": "Get record",
          "deprecated": false,
          "method": "GET",
          "path": "/records/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsRecord",
          "summary": "Check if record exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/records/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateRecord",
          "summary": "Update existing record",
          "deprecated": false,
          "method": "PATCH",
          "path": "/records/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listRelatedItems",
          "summary": "List related items",
          "deprecated": false,
          "method": "POST",
          "path": "/relateditems",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createRelatedItem",
          "summary": "Create new related item",
          "deprecated": false,
          "method": "PUT",
          "path": "/relateditems",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteRelatedItem",
          "summary": "Delete related item",
          "deprecated": false,
          "method": "DELETE",
          "path": "/relateditems/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getRelatedItem",
          "summary": "Get related item",
          "deprecated": false,
          "method": "GET",
          "path": "/relateditems/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsRelatedItem",
          "summary": "Check if related item exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/relateditems/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateRelatedItem",
          "summary": "Update existing related item",
          "deprecated": false,
          "method": "PATCH",
          "path": "/relateditems/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listResources",
          "summary": "List resources",
          "deprecated": false,
          "method": "POST",
          "path": "/resources",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getResource",
          "summary": "Get resource",
          "deprecated": false,
          "method": "GET",
          "path": "/resources/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsResource",
          "summary": "Check if resource exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/resources/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listServices",
          "summary": "List services",
          "deprecated": false,
          "method": "POST",
          "path": "/services",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getService",
          "summary": "Get service",
          "deprecated": false,
          "method": "GET",
          "path": "/services/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsService",
          "summary": "Check if service exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/services/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "getSettings",
          "summary": "Get application settings",
          "deprecated": false,
          "method": "GET",
          "path": "/settings",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "listStockTransactions",
          "summary": "List stock transactions",
          "deprecated": false,
          "method": "POST",
          "path": "/stocktransactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createStockTransaction",
          "summary": "Create new stock transaction",
          "deprecated": false,
          "method": "PUT",
          "path": "/stocktransactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteStockTransaction",
          "summary": "Delete stock transaction",
          "deprecated": false,
          "method": "DELETE",
          "path": "/stocktransactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getStockTransaction",
          "summary": "Get stock transaction",
          "deprecated": false,
          "method": "GET",
          "path": "/stocktransactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsStockTransaction",
          "summary": "Check if stock transaction exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/stocktransactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateStockTransaction",
          "summary": "Update existing stock transaction",
          "deprecated": false,
          "method": "PATCH",
          "path": "/stocktransactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listStorages",
          "summary": "List storages",
          "deprecated": false,
          "method": "POST",
          "path": "/storages",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createStorage",
          "summary": "Create new storage",
          "deprecated": false,
          "method": "PUT",
          "path": "/storages",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteStorage",
          "summary": "Delete storage",
          "deprecated": false,
          "method": "DELETE",
          "path": "/storages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getStorage",
          "summary": "Get storage",
          "deprecated": false,
          "method": "GET",
          "path": "/storages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsStorage",
          "summary": "Check if storage exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/storages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateStorage",
          "summary": "Update existing storage",
          "deprecated": false,
          "method": "PATCH",
          "path": "/storages/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listSuppliers",
          "summary": "List suppliers",
          "deprecated": false,
          "method": "POST",
          "path": "/suppliers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createSupplier",
          "summary": "Create new supplier",
          "deprecated": false,
          "method": "PUT",
          "path": "/suppliers",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteSupplier",
          "summary": "Delete supplier",
          "deprecated": false,
          "method": "DELETE",
          "path": "/suppliers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getSupplier",
          "summary": "Get supplier",
          "deprecated": false,
          "method": "GET",
          "path": "/suppliers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsSupplier",
          "summary": "Check if supplier exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/suppliers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateSupplier",
          "summary": "Update existing supplier",
          "deprecated": false,
          "method": "PATCH",
          "path": "/suppliers/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listTasks",
          "summary": "List tasks",
          "deprecated": false,
          "method": "POST",
          "path": "/tasks",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createTask",
          "summary": "Create new task",
          "deprecated": false,
          "method": "PUT",
          "path": "/tasks",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteTask",
          "summary": "Delete task",
          "deprecated": false,
          "method": "DELETE",
          "path": "/tasks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getTask",
          "summary": "Get task",
          "deprecated": false,
          "method": "GET",
          "path": "/tasks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsTask",
          "summary": "Check if task exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/tasks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateTask",
          "summary": "Update existing task",
          "deprecated": false,
          "method": "PATCH",
          "path": "/tasks/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listTickets",
          "summary": "List tickets",
          "deprecated": false,
          "method": "POST",
          "path": "/tickets",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createTicket",
          "summary": "Create new ticket",
          "deprecated": false,
          "method": "PUT",
          "path": "/tickets",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteTicket",
          "summary": "Delete ticket",
          "deprecated": false,
          "method": "DELETE",
          "path": "/tickets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getTicket",
          "summary": "Get ticket",
          "deprecated": false,
          "method": "GET",
          "path": "/tickets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsTicket",
          "summary": "Check if ticket exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/tickets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateTicket",
          "summary": "Update existing ticket",
          "deprecated": false,
          "method": "PATCH",
          "path": "/tickets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listTransactions",
          "summary": "List transactions",
          "deprecated": false,
          "method": "POST",
          "path": "/transactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "createTransaction",
          "summary": "Create new transaction",
          "deprecated": false,
          "method": "PUT",
          "path": "/transactions",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "deleteTransaction",
          "summary": "Delete transaction",
          "deprecated": false,
          "method": "DELETE",
          "path": "/transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "getTransaction",
          "summary": "Get transaction",
          "deprecated": false,
          "method": "GET",
          "path": "/transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsTransaction",
          "summary": "Check if transaction exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "updateTransaction",
          "summary": "Update existing transaction",
          "deprecated": false,
          "method": "PATCH",
          "path": "/transactions/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Match",
              "If-Unmodified-Since"
            ]
          }
        },
        {
          "operationId": "listUsers",
          "summary": "List users",
          "deprecated": false,
          "method": "POST",
          "path": "/users",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getUser",
          "summary": "Get user",
          "deprecated": false,
          "method": "GET",
          "path": "/users/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsUser",
          "summary": "Check if user exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/users/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "listWeblets",
          "summary": "List weblets",
          "deprecated": false,
          "method": "POST",
          "path": "/weblets",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getWeblet",
          "summary": "Get weblet",
          "deprecated": false,
          "method": "GET",
          "path": "/weblets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [
              "expand",
              "extdata",
              "tags"
            ],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        },
        {
          "operationId": "existsWeblet",
          "summary": "Check if weblet exists",
          "deprecated": false,
          "method": "HEAD",
          "path": "/weblets/{ID}",
          "security": [
            {
              "oauth": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [
              "ID"
            ],
            "query": [],
            "header": [
              "If-Modified-Since",
              "If-None-Match"
            ]
          }
        }
      ]
    },
    "oauth2": {
      "key": "oauth2",
      "source": "openapi/oauth2.json",
      "title": "ZeyOS OAuth 2.0 API",
      "version": "v1",
      "server": {
        "urlTemplate": "https://cloud.zeyos.com/{INSTANCE}/oauth2/v1",
        "basePathTemplate": "/{INSTANCE}/oauth2/v1",
        "defaultVariables": {
          "INSTANCE": "demo"
        }
      },
      "globalSecurity": [],
      "operations": [
        {
          "operationId": "authorize",
          "summary": "Request authorization",
          "deprecated": false,
          "method": "GET",
          "path": "/authorize",
          "security": [],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [
              "client_id",
              "redirect_uri",
              "response_type",
              "response_mode",
              "code_challenge",
              "code_challenge_method",
              "state"
            ],
            "header": []
          }
        },
        {
          "operationId": "introspectToken",
          "summary": "Introspect token",
          "deprecated": false,
          "method": "POST",
          "path": "/introspect",
          "security": [
            {
              "basic": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "revokeToken",
          "summary": "Revoke token",
          "deprecated": false,
          "method": "POST",
          "path": "/revoke",
          "security": [
            {
              "basic": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getToken",
          "summary": "Get access token",
          "deprecated": false,
          "method": "POST",
          "path": "/token",
          "security": [
            {
              "basic": []
            }
          ],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "getUserInfo",
          "summary": "Get user info",
          "deprecated": false,
          "method": "GET",
          "path": "/userinfo",
          "security": [
            {
              "token": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        }
      ]
    },
    "legacyAuth": {
      "key": "legacyAuth",
      "source": "openapi/auth.json",
      "title": "ZeyOS Legacy Authentication API",
      "version": "v1",
      "server": {
        "urlTemplate": "https://cloud.zeyos.com/{INSTANCE}/auth/v1",
        "basePathTemplate": "/{INSTANCE}/auth/v1",
        "defaultVariables": {
          "INSTANCE": "demo"
        }
      },
      "globalSecurity": [],
      "operations": [
        {
          "operationId": "getUserInfo",
          "summary": "Get User info",
          "deprecated": true,
          "method": "GET",
          "path": "/",
          "security": [
            {
              "token": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [
              "access",
              "settings"
            ],
            "header": []
          }
        },
        {
          "operationId": "verify",
          "summary": "Verify credentials",
          "deprecated": true,
          "method": "HEAD",
          "path": "/",
          "security": [
            {
              "token": []
            },
            {
              "session": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "login",
          "summary": "Login",
          "deprecated": true,
          "method": "POST",
          "path": "/login",
          "security": [],
          "requestBodyRequired": true,
          "requestContentTypes": [
            "application/x-www-form-urlencoded",
            "application/json"
          ],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        },
        {
          "operationId": "logout",
          "summary": "Logout",
          "deprecated": true,
          "method": "GET",
          "path": "/logout",
          "security": [
            {
              "token": []
            }
          ],
          "requestBodyRequired": false,
          "requestContentTypes": [],
          "parameterNames": {
            "path": [],
            "query": [],
            "header": []
          }
        }
      ]
    }
  }
};
var SERVICES = GENERATED.services;
var SERVICE_KEYS = Object.freeze(Object.keys(SERVICES));

// ../../../zeyos/client/src/generated/schema.js
var SCHEMA = {
  "accounts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "lastname": {
        "type": "text",
        "indexed": true
      },
      "firstname": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "PROSPECT",
          "1": "CUSTOMER",
          "2": "SUPPLIER",
          "3": "CUSTOMERANDSUPPLIER",
          "4": "COMPETITOR",
          "5": "EMPLOYEE"
        }
      },
      "customernum": {
        "type": "text",
        "indexed": true
      },
      "suppliernum": {
        "type": "text",
        "indexed": true
      },
      "taxid": {
        "type": "text"
      },
      "currency": {
        "type": "character varying(3)"
      },
      "locked": {
        "type": "smallint"
      },
      "excludetax": {
        "type": "smallint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "actionsteps": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "task": {
        "type": "integer",
        "indexed": true,
        "fk": "tasks"
      },
      "ticket": {
        "type": "integer",
        "indexed": true,
        "fk": "tickets"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "transaction": {
        "type": "integer",
        "indexed": true,
        "fk": "transactions"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "actionnum": {
        "type": "text",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "COMPLETED",
          "2": "CANCELLED",
          "3": "BOOKED"
        }
      },
      "effort": {
        "type": "integer"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "addresses": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "type": {
        "type": "smallint",
        "indexed": true,
        "enum": {
          "0": "BILLING_SHIPPING",
          "1": "BILLING_BILLING",
          "2": "PROCUREMENT_SHIPPING",
          "3": "PROCUREMENT_BILLING",
          "4": "COLLECTION",
          "5": "BILLING_SELLER",
          "6": "PROCUREMENT_SELLER"
        }
      },
      "default": {
        "type": "smallint",
        "indexed": true
      }
    }
  },
  "applicationassets": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "filename": {
        "type": "text",
        "indexed": true
      },
      "mimetype": {
        "type": "text"
      }
    }
  },
  "applications": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "readmebinfile": {
        "type": "integer",
        "fk": "binfiles"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "vendor": {
        "type": "text"
      },
      "restricted": {
        "type": "smallint"
      },
      "callbackurls": {
        "type": "text[]"
      },
      "settingscodebinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "usersettingscodebinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "secret": {
        "type": "bytea",
        "indexed": true
      },
      "defaultsettings": {
        "type": "json"
      },
      "settings": {
        "type": "json"
      }
    }
  },
  "appointments": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "davserver": {
        "type": "integer",
        "indexed": true,
        "fk": "davservers"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "location": {
        "type": "text",
        "indexed": true
      },
      "color": {
        "type": "character varying(6)"
      },
      "datefrom": {
        "type": "bigint",
        "indexed": true
      },
      "dateto": {
        "type": "bigint",
        "indexed": true
      },
      "recurrence": {
        "type": "smallint",
        "enum": {
          "0": "DAY",
          "1": "WORKDAY",
          "2": "WEEK",
          "3": "MONTH",
          "4": "YEAR"
        }
      },
      "interval": {
        "type": "smallint"
      },
      "maxoccurrences": {
        "type": "integer"
      },
      "daterecurrence": {
        "type": "bigint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "associations": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity1": {
        "type": "t_entity",
        "indexed": true
      },
      "entity2": {
        "type": "t_entity",
        "indexed": true
      },
      "index1": {
        "type": "integer",
        "indexed": true
      },
      "index2": {
        "type": "integer",
        "indexed": true
      },
      "relation": {
        "type": "text"
      },
      "meta": {
        "type": "json"
      }
    }
  },
  "binfiles": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "size": {
        "type": "integer",
        "indexed": true
      },
      "hash": {
        "type": "bytea",
        "indexed": true
      }
    }
  },
  "campaigns": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "datefrom": {
        "type": "bigint"
      },
      "dateto": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "NOTSTARTED",
          "2": "AWAITINGAPPROVAL",
          "3": "APPROVED",
          "4": "DISMISSED",
          "5": "ACTIVE",
          "6": "INACTIVE",
          "7": "INEVALUATION",
          "8": "CANCELLED",
          "9": "CLOSED"
        }
      },
      "description": {
        "type": "text"
      }
    }
  },
  "categories": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity": {
        "type": "text",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "channels": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "description": {
        "type": "text"
      }
    }
  },
  "comments": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "record": {
        "type": "bigint",
        "indexed": true,
        "fk": "records"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "sender": {
        "type": "text"
      },
      "text": {
        "type": "text"
      },
      "meta": {
        "type": "json"
      }
    }
  },
  "components": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "component": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "amount": {
        "type": "double precision"
      },
      "price": {
        "type": "double precision"
      },
      "fixed": {
        "type": "smallint"
      },
      "order": {
        "type": "integer"
      }
    }
  },
  "contacts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "davserver": {
        "type": "integer",
        "indexed": true,
        "fk": "davservers"
      },
      "picbinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "lastname": {
        "type": "text",
        "indexed": true
      },
      "firstname": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "COMPANY",
          "1": "PERSON"
        }
      },
      "title": {
        "type": "text"
      },
      "company": {
        "type": "text",
        "indexed": true
      },
      "position": {
        "type": "text"
      },
      "department": {
        "type": "text"
      },
      "address": {
        "type": "text"
      },
      "postalcode": {
        "type": "text"
      },
      "city": {
        "type": "text"
      },
      "region": {
        "type": "text"
      },
      "country": {
        "type": "character varying(2)"
      },
      "phone": {
        "type": "text"
      },
      "phone2": {
        "type": "text"
      },
      "cell": {
        "type": "text"
      },
      "fax": {
        "type": "text"
      },
      "email": {
        "type": "text",
        "indexed": true
      },
      "email2": {
        "type": "text",
        "indexed": true
      },
      "website": {
        "type": "text"
      },
      "birthdate": {
        "type": "bigint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "contacts2contacts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "contact1": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "contact2": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      }
    }
  },
  "contracts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "contractnum": {
        "type": "text",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "datefrom": {
        "type": "bigint"
      },
      "dateto": {
        "type": "bigint"
      },
      "datecancel": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "indexed": true,
        "enum": {
          "0": "DRAFT",
          "1": "AWAITINGAPPROVAL",
          "2": "APPROVED",
          "3": "DISMISSED",
          "4": "ACTIVE",
          "5": "INACTIVE",
          "6": "EXPIRED",
          "7": "CANCELLED",
          "8": "CLOSED"
        }
      },
      "currency": {
        "type": "character varying(3)"
      },
      "exchangerate": {
        "type": "double precision"
      },
      "billingcycle": {
        "type": "smallint"
      },
      "lastbilling": {
        "type": "bigint"
      },
      "description": {
        "type": "text"
      },
      "contractitems": {
        "type": "json"
      },
      "billingitems": {
        "type": "json"
      },
      "procurementitems": {
        "type": "json"
      },
      "autobilling": {
        "type": "json"
      }
    }
  },
  "couponcodes": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "coupon": {
        "type": "integer",
        "indexed": true,
        "fk": "coupons"
      },
      "transaction": {
        "type": "integer",
        "indexed": true,
        "fk": "transactions"
      },
      "flag": {
        "type": "smallint",
        "enum": {
          "0": "BOOKED",
          "1": "RESERVED",
          "2": "CANCELLED"
        }
      },
      "date": {
        "type": "bigint"
      },
      "code": {
        "type": "text",
        "indexed": true
      },
      "value": {
        "type": "double precision"
      },
      "datefrom": {
        "type": "bigint"
      },
      "dateto": {
        "type": "bigint"
      }
    }
  },
  "coupons": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "PROMOTION",
          "1": "INDIVIDUAL"
        }
      },
      "code": {
        "type": "text",
        "indexed": true
      },
      "value": {
        "type": "double precision"
      },
      "taxrate": {
        "type": "double precision"
      },
      "neutral": {
        "type": "smallint"
      },
      "datefrom": {
        "type": "bigint"
      },
      "dateto": {
        "type": "bigint"
      },
      "description": {
        "type": "text"
      },
      "foreigntaxrates": {
        "type": "json"
      }
    }
  },
  "cpu": {
    "type": "table",
    "fields": {
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "application": {
        "type": "integer",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "indexed": true
      },
      "count": {
        "type": "bigint"
      }
    }
  },
  "cpucollector": {
    "type": "table",
    "fields": {
      "index": {
        "type": "integer",
        "indexed": true
      },
      "count": {
        "type": "integer"
      },
      "type": {
        "type": "smallint",
        "indexed": true
      },
      "start": {
        "type": "smallint"
      },
      "ticks": {
        "type": "smallint"
      }
    }
  },
  "customfields": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "context": {
        "type": "text",
        "indexed": true
      },
      "source": {
        "type": "smallint",
        "enum": {
          "0": "EXTDATA",
          "1": "TAGS",
          "2": "INTERNAL"
        }
      },
      "reference": {
        "type": "text",
        "indexed": true
      },
      "indexed": {
        "type": "smallint"
      },
      "type": {
        "type": "text"
      },
      "entity": {
        "type": "t_entity"
      },
      "options": {
        "type": "json"
      },
      "langaliases": {
        "type": "json"
      },
      "pattern": {
        "type": "text"
      }
    }
  },
  "davids": {
    "type": "table",
    "fields": {
      "davserver": {
        "type": "integer",
        "indexed": true,
        "fk": "davservers"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "appointment": {
        "type": "integer",
        "indexed": true,
        "fk": "appointments"
      },
      "task": {
        "type": "integer",
        "indexed": true,
        "fk": "tasks"
      },
      "href": {
        "type": "text",
        "indexed": true
      },
      "etag": {
        "type": "text"
      },
      "vobject": {
        "type": "text"
      }
    }
  },
  "davservers": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "recipientuser": {
        "type": "integer",
        "fk": "users"
      },
      "recipientgroup": {
        "type": "integer",
        "fk": "groups"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "CONTACTS",
          "1": "TASKS",
          "2": "APPOINTMENTS"
        }
      },
      "url": {
        "type": "text",
        "indexed": true
      },
      "username": {
        "type": "text"
      },
      "ctag": {
        "type": "text"
      },
      "synctoken": {
        "type": "text"
      },
      "description": {
        "type": "text"
      },
      "password": {
        "type": "bytea"
      }
    }
  },
  "devices": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "contract": {
        "type": "integer",
        "indexed": true,
        "fk": "contracts"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "serialnum": {
        "type": "text",
        "indexed": true
      },
      "chargenum": {
        "type": "text",
        "indexed": true
      },
      "expdate": {
        "type": "bigint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "documents": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "documentnum": {
        "type": "text",
        "indexed": true
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "FEEDBACKREQUIRED",
          "2": "INREVISION",
          "3": "AWAITINGAPPROVAL",
          "4": "FINAL",
          "5": "OBSOLETE"
        }
      },
      "filename": {
        "type": "text",
        "indexed": true
      },
      "mimetype": {
        "type": "text"
      },
      "public": {
        "type": "smallint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "documentversions": {
    "type": "table",
    "fields": {
      "document": {
        "type": "integer",
        "indexed": true
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "filename": {
        "type": "text"
      },
      "mimetype": {
        "type": "text"
      }
    }
  },
  "dunning": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "dunningnum": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "indexed": true,
        "enum": {
          "0": "LISTING",
          "1": "REMINDER",
          "2": "NOTICE"
        }
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "BOOKED",
          "2": "CANCELLED",
          "3": "CLOSED"
        }
      },
      "fee": {
        "type": "double precision"
      },
      "recipient": {
        "type": "text"
      },
      "address": {
        "type": "text"
      },
      "postalcode": {
        "type": "text"
      },
      "city": {
        "type": "text"
      },
      "region": {
        "type": "text"
      },
      "country": {
        "type": "character varying(2)"
      }
    }
  },
  "dunning2transactions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "dunning": {
        "type": "integer",
        "indexed": true,
        "fk": "dunning"
      },
      "transaction": {
        "type": "integer",
        "indexed": true,
        "fk": "transactions"
      }
    }
  },
  "enhancementversions": {
    "type": "table",
    "fields": {
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "integer",
        "indexed": true
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)"
      },
      "mimetype": {
        "type": "text"
      }
    }
  },
  "entities2channels": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "integer",
        "indexed": true
      },
      "channel": {
        "type": "integer",
        "indexed": true,
        "fk": "channels"
      }
    }
  },
  "events": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "integer",
        "indexed": true
      },
      "name": {
        "type": "text"
      },
      "color": {
        "type": "character varying(6)"
      },
      "datefrom": {
        "type": "bigint",
        "indexed": true
      },
      "dateto": {
        "type": "bigint",
        "indexed": true
      },
      "meta": {
        "type": "json"
      }
    }
  },
  "extdata": {
    "type": "view",
    "fields": {
      "entity": {
        "type": "t_entity"
      },
      "name": {
        "type": "text"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdataempty_accounts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_actionsteps": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_applications": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_appointments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_campaigns": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_channels": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_contacts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_contracts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_couponcodes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_coupons": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_customfields": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_davservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_devices": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_documents": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_dunning": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_feedservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_forks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_groups": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_items": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_ledgers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_links": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_mailinglists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_mailservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_messages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_notes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_objects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_opportunities": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_participants": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_payments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_pricelists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_projects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_resources": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_services": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_stocktransactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_storages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_tasks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_tickets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_transactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_users": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdataempty_weblets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatafields": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "extdatanumeric_accounts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_actionsteps": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_applications": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_appointments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_campaigns": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_channels": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_contacts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_contracts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_couponcodes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_coupons": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_customfields": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_davservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_devices": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_documents": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_dunning": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_feedservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_forks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_groups": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_items": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_ledgers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_links": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_mailinglists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_mailservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_messages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_notes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_objects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_opportunities": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_participants": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_payments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_pricelists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_projects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_resources": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_services": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_stocktransactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_storages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_tasks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_tickets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_transactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_users": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatanumeric_weblets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdataregular_accounts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_actionsteps": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_applications": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_appointments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_campaigns": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_channels": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_contacts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_contracts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_couponcodes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_coupons": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_customfields": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_davservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_devices": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_documents": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_dunning": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_feedservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_forks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_groups": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_items": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_ledgers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_links": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_mailinglists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_mailservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_messages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_notes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_objects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_opportunities": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_participants": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_payments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_pricelists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_projects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_resources": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_services": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_stocktransactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_storages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_tasks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_tickets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_transactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_users": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdataregular_weblets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      },
      "value": {
        "type": "text"
      }
    }
  },
  "extdatavalues": {
    "type": "view",
    "fields": {
      "entity": {
        "type": "t_entity"
      },
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_accounts": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_actionsteps": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_applications": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_appointments": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_campaigns": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_channels": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_contacts": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_contracts": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_couponcodes": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_coupons": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_customfields": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_davservers": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_devices": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_documents": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_dunning": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_feedservers": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_forks": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_groups": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_items": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_ledgers": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_links": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_mailinglists": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_mailservers": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_messages": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_notes": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_objects": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_opportunities": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_participants": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_payments": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_pricelists": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_projects": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_resources": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_services": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_stocktransactions": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_storages": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_tasks": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_tickets": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_transactions": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_users": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatavalues_weblets": {
    "type": "view",
    "fields": {
      "field": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      },
      "value": {
        "type": "text"
      },
      "number": {
        "type": "numeric"
      }
    }
  },
  "extdatazero_accounts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_actionsteps": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_applications": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_appointments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_campaigns": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_channels": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_contacts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_contracts": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_couponcodes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_coupons": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_customfields": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_davservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_devices": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_documents": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_dunning": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_feedservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_forks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_groups": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_items": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_ledgers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_links": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_mailinglists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_mailservers": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_messages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_notes": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_objects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_opportunities": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_participants": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_payments": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_pricelists": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_projects": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_resources": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_services": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_stocktransactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_storages": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_tasks": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_tickets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_transactions": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_users": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "extdatazero_weblets": {
    "type": "table",
    "fields": {
      "field": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "feedids": {
    "type": "table",
    "fields": {
      "feedserver": {
        "type": "integer",
        "indexed": true,
        "fk": "feedservers"
      },
      "record": {
        "type": "bigint",
        "indexed": true,
        "fk": "records"
      },
      "uuid": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "feedservers": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "recipientuser": {
        "type": "integer",
        "fk": "users"
      },
      "recipientgroup": {
        "type": "integer",
        "fk": "groups"
      },
      "channel": {
        "type": "integer",
        "fk": "channels"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "url": {
        "type": "text",
        "indexed": true
      },
      "username": {
        "type": "text"
      },
      "notify": {
        "type": "smallint"
      },
      "etag": {
        "type": "text"
      },
      "description": {
        "type": "text"
      },
      "password": {
        "type": "bytea"
      }
    }
  },
  "files": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "record": {
        "type": "bigint",
        "indexed": true,
        "fk": "records"
      },
      "comment": {
        "type": "bigint",
        "indexed": true,
        "fk": "comments"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "filename": {
        "type": "text",
        "indexed": true
      },
      "mimetype": {
        "type": "text"
      }
    }
  },
  "follows": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "forks": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "group": {
        "type": "integer",
        "fk": "groups"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "module": {
        "type": "text"
      },
      "color": {
        "type": "character varying(6)"
      },
      "langaliases": {
        "type": "json"
      },
      "description": {
        "type": "text"
      },
      "settings": {
        "type": "json"
      }
    }
  },
  "groups": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "leader": {
        "type": "integer",
        "fk": "users"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "description": {
        "type": "text"
      }
    }
  },
  "groups2users": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "group": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "user": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "writable": {
        "type": "smallint"
      }
    }
  },
  "imapids": {
    "type": "table",
    "fields": {
      "mailserver": {
        "type": "integer",
        "indexed": true,
        "fk": "mailservers"
      },
      "message": {
        "type": "integer",
        "indexed": true,
        "fk": "messages"
      },
      "uidvalidity": {
        "type": "bigint",
        "indexed": true
      },
      "uid": {
        "type": "bigint",
        "indexed": true
      },
      "size": {
        "type": "integer",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "mailbox": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "imports": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "date": {
        "type": "bigint"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "settings": {
        "type": "json"
      },
      "entity": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "invitations": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "appointment": {
        "type": "integer",
        "indexed": true,
        "fk": "appointments"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "name": {
        "type": "text"
      },
      "email": {
        "type": "text"
      },
      "flag": {
        "type": "smallint",
        "enum": {
          "0": "UNANSWERED",
          "1": "CONFIRMED",
          "2": "REJECTED"
        }
      }
    }
  },
  "items": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "model": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "picbinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "manufacturer": {
        "type": "text",
        "indexed": true
      },
      "itemnum": {
        "type": "text",
        "indexed": true
      },
      "barcode": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "SIMPLE",
          "1": "SERIALS",
          "2": "CHARGES",
          "3": "SERIALSANDCHARGES",
          "4": "SET",
          "5": "CONTAINER",
          "6": "NOSTOCK",
          "7": "MODEL"
        }
      },
      "forcestock": {
        "type": "smallint",
        "enum": {
          "0": "STORAGE",
          "1": "LOCATION"
        }
      },
      "applicability": {
        "type": "smallint",
        "enum": {
          "0": "ALWAYS",
          "1": "NEVER",
          "2": "BILLINGONLY",
          "3": "PROCUREMENTONLY"
        }
      },
      "unit": {
        "type": "character varying(3)"
      },
      "sellingprice": {
        "type": "double precision"
      },
      "purchaseprice": {
        "type": "double precision"
      },
      "taxrate": {
        "type": "double precision"
      },
      "weight": {
        "type": "double precision"
      },
      "classcode": {
        "type": "text"
      },
      "tariffcode": {
        "type": "text"
      },
      "origin": {
        "type": "character varying(2)"
      },
      "description": {
        "type": "text"
      },
      "foreigntaxrates": {
        "type": "json"
      }
    }
  },
  "ledgers": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "description": {
        "type": "text"
      }
    }
  },
  "likes": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "record": {
        "type": "bigint",
        "indexed": true,
        "fk": "records"
      }
    }
  },
  "links": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "url": {
        "type": "text",
        "indexed": true
      },
      "expdate": {
        "type": "bigint"
      },
      "username": {
        "type": "text"
      },
      "password": {
        "type": "text"
      },
      "visits": {
        "type": "integer"
      },
      "description": {
        "type": "text"
      },
      "password_encrypted": {
        "type": "bytea"
      },
      "otpsecret": {
        "type": "bytea"
      }
    }
  },
  "logins": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true
      },
      "status": {
        "type": "smallint"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "logoutdate": {
        "type": "bigint"
      },
      "sessionid": {
        "type": "bytea"
      },
      "ip": {
        "type": "bytea"
      }
    }
  },
  "mailinglists": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "campaign": {
        "type": "integer",
        "indexed": true,
        "fk": "campaigns"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "sender": {
        "type": "text",
        "indexed": true
      },
      "description": {
        "type": "text"
      }
    }
  },
  "mailingrecipients": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "message": {
        "type": "integer",
        "indexed": true,
        "fk": "messages"
      },
      "participant": {
        "type": "bigint",
        "indexed": true,
        "fk": "participants"
      },
      "email": {
        "type": "text"
      }
    }
  },
  "mailservers": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "recipientuser": {
        "type": "integer",
        "fk": "users"
      },
      "recipientgroup": {
        "type": "integer",
        "fk": "groups"
      },
      "autoreplybinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "signaturebinfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "sender": {
        "type": "text",
        "indexed": true
      },
      "serverin": {
        "type": "text",
        "indexed": true
      },
      "usernamein": {
        "type": "text"
      },
      "serverout": {
        "type": "text",
        "indexed": true
      },
      "usernameout": {
        "type": "text"
      },
      "description": {
        "type": "text"
      },
      "ticketing": {
        "type": "json"
      },
      "folders": {
        "type": "json"
      },
      "passwordin": {
        "type": "bytea"
      },
      "passwordout": {
        "type": "bytea"
      }
    }
  },
  "messagereads": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "message": {
        "type": "integer",
        "indexed": true,
        "fk": "messages"
      }
    }
  },
  "messages": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "mailserver": {
        "type": "integer",
        "indexed": true,
        "fk": "mailservers"
      },
      "ticket": {
        "type": "integer",
        "indexed": true,
        "fk": "tickets"
      },
      "opportunity": {
        "type": "integer",
        "indexed": true,
        "fk": "opportunities"
      },
      "mailinglist": {
        "type": "integer",
        "indexed": true,
        "fk": "mailinglists"
      },
      "reference": {
        "type": "integer",
        "indexed": true,
        "fk": "messages"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "mailbox": {
        "type": "smallint",
        "enum": {
          "0": "INBOX",
          "1": "DRAFTS",
          "2": "SENT",
          "3": "TEMPLATES",
          "4": "MAILINGS",
          "5": "ARCHIVE",
          "6": "TRASH",
          "7": "JUNK"
        }
      },
      "verified": {
        "type": "smallint"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "subject": {
        "type": "text",
        "indexed": true
      },
      "sender": {
        "type": "text",
        "indexed": true
      },
      "sender_email": {
        "type": "text"
      },
      "sender_name": {
        "type": "text"
      },
      "to": {
        "type": "text",
        "indexed": true
      },
      "to_email": {
        "type": "text"
      },
      "to_name": {
        "type": "text"
      },
      "to_count": {
        "type": "integer"
      },
      "cc": {
        "type": "text"
      },
      "bcc": {
        "type": "text"
      },
      "contenttype": {
        "type": "text"
      },
      "text": {
        "type": "text"
      },
      "attachments": {
        "type": "text[]"
      },
      "senddate": {
        "type": "bigint"
      },
      "senderror": {
        "type": "text"
      },
      "messageid": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_cities": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "state": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_states"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "wikidataid": {
        "type": "text"
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      }
    }
  },
  "meta_countries": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "subregion": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_subregions"
      },
      "currency": {
        "type": "smallint",
        "fk": "meta_currencies"
      },
      "tld": {
        "type": "smallint",
        "fk": "meta_tlds"
      },
      "iso_alpha2": {
        "type": "character varying(2)",
        "indexed": true
      },
      "iso_alpha3": {
        "type": "character varying(3)",
        "indexed": true
      },
      "iso_numeric": {
        "type": "character varying(3)",
        "indexed": true
      },
      "edgar": {
        "type": "character varying(2)"
      },
      "fifa": {
        "type": "character varying(4)"
      },
      "fips": {
        "type": "character varying(4)"
      },
      "ioc": {
        "type": "character varying(3)"
      },
      "itu": {
        "type": "character varying(3)"
      },
      "m49": {
        "type": "character varying(3)"
      },
      "marc": {
        "type": "text"
      },
      "vri": {
        "type": "character varying(3)"
      },
      "wmo": {
        "type": "character varying(2)"
      },
      "geonameid": {
        "type": "integer"
      },
      "wikidataid": {
        "type": "text"
      },
      "independent": {
        "type": "boolean"
      },
      "un": {
        "type": "boolean"
      },
      "ldc": {
        "type": "boolean"
      },
      "lldc": {
        "type": "boolean"
      },
      "sids": {
        "type": "boolean"
      },
      "flag": {
        "type": "text"
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      },
      "population": {
        "type": "bigint"
      },
      "area": {
        "type": "integer"
      },
      "capital": {
        "type": "text"
      },
      "callingcodes": {
        "type": "text[]"
      }
    }
  },
  "meta_countries_borders": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "country": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      }
    }
  },
  "meta_countries_languages": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "priority": {
        "type": "smallint"
      }
    }
  },
  "meta_countries_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "formal": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_currencies": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "iso_alpha": {
        "type": "character varying(3)",
        "indexed": true
      },
      "iso_numeric": {
        "type": "character varying(3)",
        "indexed": true
      },
      "fund": {
        "type": "boolean"
      },
      "decimals": {
        "type": "smallint"
      },
      "symbol": {
        "type": "text"
      },
      "withdrawal": {
        "type": "text"
      }
    }
  },
  "meta_currencies_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_currencies"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_languages": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "iso_alpha2": {
        "type": "character varying(2)",
        "indexed": true
      },
      "iso_alpha3t": {
        "type": "character varying(3)",
        "indexed": true
      },
      "iso_alpha3b": {
        "type": "character varying(3)",
        "indexed": true
      }
    }
  },
  "meta_languages_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_modules": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "umi": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_modules_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_modules"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_postalcodes": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "country": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "state": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_states"
      },
      "code": {
        "type": "character varying(20)",
        "indexed": true
      },
      "place": {
        "type": "text",
        "indexed": true
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      }
    }
  },
  "meta_regions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "wikidataid": {
        "type": "text"
      }
    }
  },
  "meta_regions_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_regions"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_states": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "country": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "code": {
        "type": "character varying(5)",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      }
    }
  },
  "meta_subregions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "region": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_regions"
      },
      "wikidataid": {
        "type": "text"
      }
    }
  },
  "meta_subregions_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_subregions"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_cn": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "parents": {
        "type": "smallint[]"
      },
      "code": {
        "type": "character varying(8)",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_cn_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_taxonomy_cn"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_cpv": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "parents": {
        "type": "smallint[]"
      },
      "code": {
        "type": "character varying(10)",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_cpv_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_taxonomy_cpv"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_google": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "parents": {
        "type": "smallint[]"
      },
      "code": {
        "type": "integer",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_google_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_taxonomy_google"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_gpc": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "parents": {
        "type": "smallint[]"
      },
      "code": {
        "type": "character varying(17)",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_gpc_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_taxonomy_gpc"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "definition": {
        "type": "text"
      }
    }
  },
  "meta_taxonomy_hts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "parents": {
        "type": "integer[]"
      },
      "code": {
        "type": "character varying(10)",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_hts_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true,
        "fk": "meta_taxonomy_hts"
      },
      "language": {
        "type": "integer",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_unspsc": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "parents": {
        "type": "smallint[]"
      },
      "code": {
        "type": "character varying(8)",
        "indexed": true
      }
    }
  },
  "meta_taxonomy_unspsc_names": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_taxonomy_unspsc"
      },
      "language": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_languages"
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "meta_timezones": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "country": {
        "type": "smallint",
        "indexed": true,
        "fk": "meta_countries"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      },
      "comments": {
        "type": "text"
      },
      "abbreviations": {
        "type": "text[]"
      }
    }
  },
  "meta_timezones_offsets": {
    "type": "view",
    "fields": {
      "ID": {
        "type": "smallint"
      },
      "country": {
        "type": "smallint"
      },
      "name": {
        "type": "text"
      },
      "latitude": {
        "type": "double precision"
      },
      "longitude": {
        "type": "double precision"
      },
      "comments": {
        "type": "text"
      },
      "abbreviations": {
        "type": "text[]"
      },
      "offset": {
        "type": "interval"
      },
      "dst": {
        "type": "boolean"
      }
    }
  },
  "meta_tlds": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "domain": {
        "type": "text",
        "indexed": true
      },
      "suffixes": {
        "type": "text[]"
      }
    }
  },
  "meta_units": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "smallint",
        "indexed": true
      },
      "status": {
        "type": "smallint"
      },
      "code": {
        "type": "character varying(3)",
        "indexed": true
      },
      "level": {
        "type": "character varying(3)"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "sector": {
        "type": "text"
      },
      "quantity": {
        "type": "text"
      },
      "conversion": {
        "type": "text"
      },
      "symbol": {
        "type": "text"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "notes": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "FEEDBACKREQUIRED",
          "2": "INREVISION",
          "3": "AWAITINGAPPROVAL",
          "4": "FINAL",
          "5": "OBSOLETE"
        }
      },
      "contenttype": {
        "type": "text"
      },
      "text": {
        "type": "text"
      },
      "attachments": {
        "type": "text[]"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "notifications": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true
      },
      "record": {
        "type": "bigint",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "flag": {
        "type": "smallint"
      }
    }
  },
  "numcounters": {
    "type": "table",
    "fields": {
      "identifier": {
        "type": "text",
        "indexed": true
      },
      "counter": {
        "type": "bigint"
      }
    }
  },
  "objects": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "entity": {
        "type": "text",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "description": {
        "type": "text"
      },
      "data": {
        "type": "json"
      }
    }
  },
  "opportunities": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "campaign": {
        "type": "integer",
        "indexed": true,
        "fk": "campaigns"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "opportunitynum": {
        "type": "text",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "UNEVALUATED",
          "1": "ELIGIBLE",
          "2": "FEEDBACKREQUIRED",
          "3": "INNEGOTIATION",
          "4": "OFFERED",
          "5": "ACCEPTED",
          "6": "REJECTED"
        }
      },
      "priority": {
        "type": "smallint",
        "enum": {
          "0": "LOWEST",
          "1": "LOW",
          "2": "MEDIUM",
          "3": "HIGH",
          "4": "HIGHEST"
        }
      },
      "probability": {
        "type": "smallint"
      },
      "worstcase": {
        "type": "double precision"
      },
      "mostlikely": {
        "type": "double precision"
      },
      "upside": {
        "type": "double precision"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "participants": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "mailinglist": {
        "type": "integer",
        "indexed": true,
        "fk": "mailinglists"
      },
      "campaign": {
        "type": "integer",
        "indexed": true,
        "fk": "campaigns"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "phone": {
        "type": "text"
      },
      "email": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "payments": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "ledger": {
        "type": "integer",
        "indexed": true,
        "fk": "ledgers"
      },
      "transaction": {
        "type": "integer",
        "indexed": true,
        "fk": "transactions"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "subject": {
        "type": "text",
        "indexed": true
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "COMPLETED",
          "2": "CANCELLED",
          "3": "BOOKED"
        }
      },
      "amount": {
        "type": "double precision"
      },
      "autoadvance": {
        "type": "smallint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "permissions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "group": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "writable": {
        "type": "smallint"
      }
    }
  },
  "pricelists": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "BILLING_MIN",
          "1": "BILLING_MAX",
          "2": "PROCUREMENT_MIN",
          "3": "PROCUREMENT_MAX",
          "4": "PRODUCTION_MIN",
          "5": "PRODUCTION_MAX"
        }
      },
      "currency": {
        "type": "character varying(3)"
      },
      "discount": {
        "type": "double precision"
      },
      "datefrom": {
        "type": "bigint"
      },
      "dateto": {
        "type": "bigint"
      },
      "applytoall": {
        "type": "smallint"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "pricelists2accounts": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "pricelist": {
        "type": "integer",
        "indexed": true,
        "fk": "pricelists"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      }
    }
  },
  "prices": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "pricelist": {
        "type": "integer",
        "indexed": true,
        "fk": "pricelists"
      },
      "price": {
        "type": "double precision"
      },
      "rebate": {
        "type": "double precision"
      },
      "discount": {
        "type": "double precision"
      },
      "minamount": {
        "type": "double precision"
      },
      "costprice": {
        "type": "double precision"
      }
    }
  },
  "projects": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "projectnum": {
        "type": "text",
        "indexed": true
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "NOTSTARTED",
          "2": "AWAITINGAPPROVAL",
          "3": "APPROVED",
          "4": "DISMISSED",
          "5": "ACTIVE",
          "6": "INACTIVE",
          "7": "TESTING",
          "8": "CANCELLED",
          "9": "COMPLETED",
          "10": "FAILED",
          "11": "BOOKED"
        }
      },
      "description": {
        "type": "text"
      }
    }
  },
  "recent": {
    "type": "table",
    "fields": {
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "integer",
        "indexed": true
      },
      "user": {
        "type": "integer",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "records": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer",
        "indexed": true
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "index": {
        "type": "integer",
        "indexed": true
      },
      "channel": {
        "type": "integer",
        "indexed": true,
        "fk": "channels"
      },
      "flag": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ASSOCONLY",
          "2": "MINDLOGONLY",
          "3": "MONITOR",
          "4": "FEED"
        }
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "stickydate": {
        "type": "bigint",
        "indexed": true
      },
      "sender": {
        "type": "text",
        "indexed": true
      },
      "location": {
        "type": "text"
      },
      "text": {
        "type": "text",
        "indexed": true
      },
      "meta": {
        "type": "json"
      }
    }
  },
  "relateditems": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "relateditem": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "relation": {
        "type": "text"
      }
    }
  },
  "resources": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "mimetype": {
        "type": "text"
      },
      "public": {
        "type": "smallint"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      }
    }
  },
  "services": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "TIMING",
          "1": "REMOTECALL",
          "2": "AFTER_CREATION",
          "3": "BEFORE_MODIFICATION",
          "4": "AFTER_MODIFICATION",
          "5": "AFTER_CREATION_MODIFICATION",
          "6": "BEFORE_DELETION",
          "7": "AFTER_DELETION"
        }
      },
      "entity": {
        "type": "text"
      },
      "schedule": {
        "type": "integer"
      },
      "interval": {
        "type": "smallint"
      },
      "mimetype": {
        "type": "text"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "url": {
        "type": "text"
      },
      "accesskey": {
        "type": "bytea"
      }
    }
  },
  "stocktransactions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "storage": {
        "type": "integer",
        "indexed": true,
        "fk": "storages"
      },
      "transaction": {
        "type": "integer",
        "indexed": true,
        "fk": "transactions"
      },
      "transfer": {
        "type": "bigint",
        "indexed": true,
        "fk": "stocktransactions"
      },
      "flag": {
        "type": "smallint",
        "enum": {
          "0": "BOOKED",
          "1": "RESERVED",
          "2": "CANCELLED"
        }
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "chargenum": {
        "type": "text",
        "indexed": true
      },
      "location": {
        "type": "text"
      },
      "reference": {
        "type": "text",
        "indexed": true
      },
      "amount": {
        "type": "double precision"
      },
      "sellingprice": {
        "type": "double precision"
      },
      "purchaseprice": {
        "type": "double precision"
      },
      "serials": {
        "type": "text[]",
        "indexed": true
      },
      "subtransactions": {
        "type": "bigint[]"
      }
    }
  },
  "storages": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "description": {
        "type": "text"
      }
    }
  },
  "suppliers": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "itemnum": {
        "type": "text",
        "indexed": true
      },
      "price": {
        "type": "double precision"
      },
      "taxrate": {
        "type": "double precision"
      },
      "minamount": {
        "type": "double precision"
      },
      "deliverytime": {
        "type": "smallint"
      },
      "stock": {
        "type": "double precision"
      }
    }
  },
  "tagnames": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "bigint",
        "indexed": true
      },
      "entity": {
        "type": "t_entity",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      }
    }
  },
  "tagrels": {
    "type": "view",
    "fields": {
      "entity": {
        "type": "t_entity"
      },
      "name": {
        "type": "bigint"
      },
      "index": {
        "type": "bigint"
      }
    }
  },
  "tagrels_accounts": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_actionsteps": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_applications": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_appointments": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_campaigns": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_channels": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_contacts": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_contracts": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_coupons": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_customfields": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_davservers": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_devices": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_documents": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_dunning": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_feedservers": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_forks": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_groups": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_items": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_ledgers": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_links": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_mailinglists": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_mailservers": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_messages": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_notes": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_objects": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_opportunities": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_payments": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_pricelists": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_projects": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_resources": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_services": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_storages": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_tasks": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_tickets": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_transactions": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_users": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tagrels_weblets": {
    "type": "table",
    "fields": {
      "name": {
        "type": "bigint",
        "indexed": true
      },
      "index": {
        "type": "bigint",
        "indexed": true
      }
    }
  },
  "tags": {
    "type": "view",
    "fields": {
      "entity": {
        "type": "t_entity"
      },
      "name": {
        "type": "text"
      },
      "index": {
        "type": "bigint"
      }
    }
  },
  "tasks": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "owneruser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "davserver": {
        "type": "integer",
        "indexed": true,
        "fk": "davservers"
      },
      "ticket": {
        "type": "integer",
        "indexed": true,
        "fk": "tickets"
      },
      "project": {
        "type": "integer",
        "indexed": true,
        "fk": "projects"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "tasknum": {
        "type": "text",
        "indexed": true
      },
      "datefrom": {
        "type": "bigint"
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "NOTSTARTED",
          "1": "AWAITINGACCEPTANCE",
          "2": "ACCEPTED",
          "3": "REJECTED",
          "4": "ACTIVE",
          "5": "INACTIVE",
          "6": "FEEDBACKREQUIRED",
          "7": "TESTING",
          "8": "CANCELLED",
          "9": "COMPLETED",
          "10": "FAILED",
          "11": "BOOKED"
        }
      },
      "priority": {
        "type": "smallint",
        "enum": {
          "0": "LOWEST",
          "1": "LOW",
          "2": "MEDIUM",
          "3": "HIGH",
          "4": "HIGHEST"
        }
      },
      "projectedeffort": {
        "type": "integer"
      },
      "description": {
        "type": "text"
      }
    }
  },
  "tickets": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "project": {
        "type": "integer",
        "indexed": true,
        "fk": "projects"
      },
      "visibility": {
        "type": "smallint",
        "enum": {
          "0": "REGULAR",
          "1": "ARCHIVED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "ticketnum": {
        "type": "text",
        "indexed": true
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "NOTSTARTED",
          "1": "AWAITINGACCEPTANCE",
          "2": "ACCEPTED",
          "3": "REJECTED",
          "4": "ACTIVE",
          "5": "INACTIVE",
          "6": "FEEDBACKREQUIRED",
          "7": "TESTING",
          "8": "CANCELLED",
          "9": "COMPLETED",
          "10": "FAILED",
          "11": "BOOKED"
        }
      },
      "priority": {
        "type": "smallint",
        "enum": {
          "0": "LOWEST",
          "1": "LOW",
          "2": "MEDIUM",
          "3": "HIGH",
          "4": "HIGHEST"
        }
      },
      "description": {
        "type": "text"
      },
      "billingitems": {
        "type": "json"
      },
      "procurementitems": {
        "type": "json"
      }
    }
  },
  "tokens": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "token": {
        "type": "bytea",
        "indexed": true
      },
      "expdate": {
        "type": "bigint"
      },
      "type": {
        "type": "smallint",
        "indexed": true
      },
      "hint": {
        "type": "text"
      },
      "challenge": {
        "type": "bytea"
      }
    }
  },
  "transactions": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "ownergroup": {
        "type": "integer",
        "indexed": true,
        "fk": "groups"
      },
      "creator": {
        "type": "integer"
      },
      "assigneduser": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "account": {
        "type": "integer",
        "indexed": true,
        "fk": "accounts"
      },
      "item": {
        "type": "integer",
        "indexed": true,
        "fk": "items"
      },
      "contract": {
        "type": "integer",
        "indexed": true,
        "fk": "contracts"
      },
      "transactionnum": {
        "type": "text",
        "indexed": true
      },
      "type": {
        "type": "smallint",
        "indexed": true,
        "enum": {
          "0": "BILLING_QUOTE",
          "1": "BILLING_ORDER",
          "2": "BILLING_DELIVERY",
          "3": "BILLING_INVOICE",
          "4": "BILLING_CREDIT",
          "5": "PROCUREMENT_REQUEST",
          "6": "PROCUREMENT_ORDER",
          "7": "PROCUREMENT_DELIVERY",
          "8": "PROCUREMENT_INVOICE",
          "9": "PROCUREMENT_CREDIT",
          "10": "PRODUCTION_FABRICATION",
          "11": "PRODUCTION_DISASSEMBLY"
        }
      },
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "duedate": {
        "type": "bigint"
      },
      "status": {
        "type": "smallint",
        "enum": {
          "0": "DRAFT",
          "1": "BOOKED",
          "2": "HOLD",
          "3": "CANCELLED",
          "4": "CLOSED",
          "5": "PARTLYORDERED",
          "6": "PARTLYORDERED_CANCELLED",
          "7": "PARTLYORDERED_CLOSED",
          "8": "ORDERED",
          "9": "PARTLYDELIVERED",
          "10": "PARTLYDELIVERED_CANCELLED",
          "11": "PARTLYDELIVERED_CLOSED",
          "12": "DELIVERED",
          "13": "PARTLYINVOICED",
          "14": "PARTLYINVOICED_CANCELLED",
          "15": "PARTLYINVOICED_CLOSED",
          "16": "INVOICED",
          "17": "PARTLYPAID",
          "18": "PARTLYPAID_CANCELLED",
          "19": "PARTLYPAID_CLOSED",
          "20": "PAID",
          "21": "OVERPAID",
          "22": "PROCESSED",
          "23": "PROCESSED_CANCELLED"
        }
      },
      "calculation": {
        "type": "smallint",
        "enum": {
          "0": "NET",
          "1": "GROSS",
          "2": "EXACT",
          "3": "LEGACY",
          "4": "EXTERNAL"
        }
      },
      "productionfactor": {
        "type": "integer"
      },
      "currency": {
        "type": "character varying(3)"
      },
      "exchangerate": {
        "type": "double precision"
      },
      "taxid": {
        "type": "text"
      },
      "shippingrecipient": {
        "type": "text"
      },
      "shippingaddress": {
        "type": "text"
      },
      "shippingpostalcode": {
        "type": "text"
      },
      "shippingcity": {
        "type": "text"
      },
      "shippingregion": {
        "type": "text"
      },
      "shippingcountry": {
        "type": "character varying(2)"
      },
      "billingrecipient": {
        "type": "text"
      },
      "billingaddress": {
        "type": "text"
      },
      "billingpostalcode": {
        "type": "text"
      },
      "billingcity": {
        "type": "text"
      },
      "billingregion": {
        "type": "text"
      },
      "billingcountry": {
        "type": "character varying(2)"
      },
      "sellertaxid": {
        "type": "text"
      },
      "sellername": {
        "type": "text"
      },
      "selleraddress": {
        "type": "text"
      },
      "sellerpostalcode": {
        "type": "text"
      },
      "sellercity": {
        "type": "text"
      },
      "sellerregion": {
        "type": "text"
      },
      "sellercountry": {
        "type": "character varying(2)"
      },
      "discount": {
        "type": "double precision"
      },
      "netamount": {
        "type": "double precision"
      },
      "tax": {
        "type": "double precision"
      },
      "margin": {
        "type": "double precision"
      },
      "weight": {
        "type": "double precision"
      },
      "items": {
        "type": "json"
      }
    }
  },
  "usagestats": {
    "type": "table",
    "fields": {
      "date": {
        "type": "bigint",
        "indexed": true
      },
      "users": {
        "type": "integer"
      },
      "apiusers": {
        "type": "integer"
      },
      "dbtuples": {
        "type": "bigint"
      },
      "binsize": {
        "type": "bigint"
      },
      "fssize": {
        "type": "bigint"
      },
      "cpu": {
        "type": "bigint"
      }
    }
  },
  "userfields": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "view": {
        "type": "text",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "data": {
        "type": "json"
      }
    }
  },
  "userfilters": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true,
        "fk": "users"
      },
      "fork": {
        "type": "integer",
        "indexed": true,
        "fk": "forks"
      },
      "view": {
        "type": "text",
        "indexed": true
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "data": {
        "type": "json"
      }
    }
  },
  "users": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "contact": {
        "type": "integer",
        "indexed": true,
        "fk": "contacts"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "email": {
        "type": "text",
        "indexed": true
      },
      "nopublic": {
        "type": "smallint"
      },
      "apionly": {
        "type": "smallint"
      },
      "expdate": {
        "type": "bigint"
      },
      "password": {
        "type": "text"
      },
      "resetlogintoken": {
        "type": "bytea"
      },
      "persistentlogintoken": {
        "type": "bytea",
        "indexed": true
      },
      "signature": {
        "type": "bytea"
      },
      "description": {
        "type": "text"
      },
      "otpsecret": {
        "type": "bytea"
      },
      "settings": {
        "type": "json"
      }
    }
  },
  "views": {
    "type": "table",
    "fields": {
      "user": {
        "type": "integer",
        "indexed": true
      },
      "view": {
        "type": "text",
        "indexed": true
      },
      "data": {
        "type": "text"
      },
      "fork": {
        "type": "integer",
        "indexed": true
      }
    }
  },
  "weblets": {
    "type": "table",
    "fields": {
      "ID": {
        "type": "integer",
        "indexed": true
      },
      "creator": {
        "type": "integer"
      },
      "creationdate": {
        "type": "bigint"
      },
      "lastmodified": {
        "type": "bigint"
      },
      "application": {
        "type": "integer",
        "indexed": true,
        "fk": "applications"
      },
      "activity": {
        "type": "smallint",
        "enum": {
          "0": "ACTIVE",
          "1": "DEACTIVATED",
          "2": "DELETED"
        }
      },
      "name": {
        "type": "text",
        "indexed": true
      },
      "identifier": {
        "type": "character varying(200)",
        "indexed": true
      },
      "view": {
        "type": "text"
      },
      "type": {
        "type": "smallint",
        "enum": {
          "0": "INTEGRATED",
          "1": "STANDALONE",
          "2": "DETACHED",
          "3": "POPUP_FRAMED",
          "4": "POPUP_PLAIN",
          "5": "EMBEDDED_FRAMED",
          "6": "EMBEDDED_COLLAPSED",
          "7": "EMBEDDED_PLAIN"
        }
      },
      "width": {
        "type": "smallint"
      },
      "height": {
        "type": "smallint"
      },
      "svgpath": {
        "type": "text"
      },
      "color": {
        "type": "character varying(6)"
      },
      "mimetype": {
        "type": "text"
      },
      "langaliases": {
        "type": "json"
      },
      "binfile": {
        "type": "integer",
        "indexed": true,
        "fk": "binfiles"
      },
      "url": {
        "type": "text"
      }
    }
  }
};
var SCHEMA_RESOURCES = Object.freeze(Object.keys(SCHEMA));

// ../../../zeyos/client/src/runtime/error.js
var ZeyosApiError = class extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ZeyosApiError";
    this.status = details.status ?? 0;
    this.statusText = details.statusText ?? "";
    this.headers = details.headers ?? {};
    this.body = details.body ?? null;
    this.method = details.method ?? "";
    this.url = details.url ?? "";
    this.operationId = details.operationId ?? "";
    this.service = details.service ?? "";
    this.cause = details.cause;
  }
};
var ZeyosValidationError = class extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ZeyosValidationError";
    this.operationId = details.operationId ?? "";
    this.errors = Array.isArray(details.errors) ? details.errors : [];
  }
};

// ../../../zeyos/client/src/runtime/http.js
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
function encodePrimitive(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
function appendQueryValue(search, key, value) {
  if (value == null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(search, key, item);
    }
    return;
  }
  if (isPlainObject(value)) {
    search.append(key, JSON.stringify(value));
    return;
  }
  search.append(key, encodePrimitive(value));
}
function buildQueryString(query = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(search, key, value);
  }
  return search.toString();
}
function applyPathParams(pathTemplate, pathParams = {}) {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, token) => {
    if (!Object.prototype.hasOwnProperty.call(pathParams, token)) {
      throw new Error(`Missing path parameter: ${token}`);
    }
    const rawValue = pathParams[token];
    if (rawValue == null) {
      throw new Error(`Path parameter cannot be null: ${token}`);
    }
    return encodeURIComponent(String(rawValue));
  });
}
function buildUrl(baseUrl, pathTemplate, pathParams = {}, query = {}) {
  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const resolvedPath = applyPathParams(pathTemplate, pathParams);
  const normalizedPath = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
  const rawUrl = `${normalizedBase}${normalizedPath}`;
  const queryString = buildQueryString(query);
  return queryString ? `${rawUrl}?${queryString}` : rawUrl;
}
function valueToFormValues(value) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valueToFormValues(item));
  }
  if (isPlainObject(value)) {
    return [JSON.stringify(value)];
  }
  return [encodePrimitive(value)];
}
function toFormUrlEncoded(value) {
  const search = new URLSearchParams();
  if (!value || typeof value !== "object") {
    return search.toString();
  }
  for (const [key, rawValue] of Object.entries(value)) {
    for (const part of valueToFormValues(rawValue)) {
      search.append(key, part);
    }
  }
  return search.toString();
}
function headersToObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}
async function parseResponseBody(response, method) {
  if (method === "HEAD" || response.status === 204 || response.status === 205 || response.status === 304) {
    return null;
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  const isJson = /(^|\b|;)application\/([a-z0-9.+-]*\+)?json\b/i.test(contentType);
  if (!isJson) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
async function httpRequest({
  fetchImpl,
  url,
  method,
  headers = {},
  body,
  bodyType,
  signal,
  credentials
}) {
  const requestHeaders = new Headers(headers);
  let payload;
  if (body != null) {
    if (bodyType === "form") {
      if (!requestHeaders.has("content-type")) {
        requestHeaders.set("content-type", "application/x-www-form-urlencoded");
      }
      payload = toFormUrlEncoded(body);
    } else if (bodyType === "json") {
      if (!requestHeaders.has("content-type")) {
        requestHeaders.set("content-type", "application/json");
      }
      payload = JSON.stringify(body);
    } else {
      payload = body;
    }
  }
  const response = await fetchImpl(url, {
    method,
    headers: requestHeaders,
    body: payload,
    signal,
    credentials
  });
  const data = await parseResponseBody(response, method);
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    data,
    response
  };
}

// ../../../zeyos/client/src/runtime/request-shape.js
var REQUEST_CONTROL_KEYS = Object.freeze([
  "path",
  "query",
  "headers",
  "body",
  "data",
  "auth",
  "bodyType",
  "signal",
  "raw",
  "baseUrl"
]);
var VALIDATION_CONTROL_KEYS = Object.freeze([
  ...REQUEST_CONTROL_KEYS,
  "validate"
]);
var OBJECT_CONTROL_KEYS = Object.freeze([
  "path",
  "query",
  "headers"
]);

// ../../../zeyos/client/src/runtime/suggest.js
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}
function suggestClosest(name, candidates) {
  if (typeof name !== "string" || !name) return null;
  const list = Array.from(candidates);
  const lowerName = name.toLowerCase();
  let exact = null;
  let substring = null;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of list) {
    if (typeof candidate !== "string" || !candidate) continue;
    const lower = candidate.toLowerCase();
    if (lower === lowerName) {
      exact = candidate;
      break;
    }
    if (!substring && (lower.includes(lowerName) || lowerName.includes(lower))) {
      substring = candidate;
    }
    const distance = levenshtein(lowerName, lower);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (exact) return exact;
  if (substring) return substring;
  const threshold = Math.max(2, Math.floor(name.length / 3));
  return bestDistance <= threshold ? best : null;
}

// ../../../zeyos/client/src/runtime/schema.js
var QUERY_DIRECTIVES = /* @__PURE__ */ new Set([
  "fields",
  "filter",
  "filters",
  "sort",
  "limit",
  "offset",
  "count",
  "query",
  "distinct",
  "expand",
  "extdata",
  "tags",
  "group",
  "having",
  "visibility"
]);
var CONTROL_KEYS = new Set(VALIDATION_CONTROL_KEYS);
var REQUIRED_CREATE_FIELDS = {
  accounts: ["currency"]
};
function resourceFromPath(path) {
  if (typeof path !== "string") return null;
  for (const segment of path.split("/")) {
    if (segment && !segment.startsWith("{")) return segment;
  }
  return null;
}
function baseFieldName(ref) {
  if (typeof ref !== "string") return null;
  const head = ref.split(".")[0].trim();
  return head || null;
}
function sortFieldName(ref) {
  if (typeof ref !== "string") return null;
  return ref.trim().replace(/^[+-]/, "").replace(/:(?:asc|desc)$/i, "");
}
function createSchema({ services, schema }) {
  const schemaMap = schema && typeof schema === "object" ? schema : {};
  const resourceNames = Object.keys(schemaMap);
  const opIndex = /* @__PURE__ */ new Map();
  const allOperationIds = [];
  for (const [serviceKey, service] of Object.entries(services || {})) {
    for (const operation of service.operations || []) {
      allOperationIds.push(operation.operationId);
      opIndex.set(operation.operationId, {
        service: serviceKey,
        operation,
        resource: resourceFromPath(operation.path)
      });
    }
  }
  function resources() {
    return resourceNames.slice();
  }
  function describe(resource) {
    const entry = schemaMap[resource];
    if (!entry) return null;
    return { name: resource, type: entry.type, fields: entry.fields };
  }
  function fields(resource) {
    const entry = schemaMap[resource];
    return entry ? Object.keys(entry.fields) : [];
  }
  function operationIds() {
    return allOperationIds.slice();
  }
  function operations(resource) {
    if (resource == null) return allOperationIds.slice();
    return allOperationIds.filter((id) => opIndex.get(id)?.resource === resource);
  }
  function resourceForOperation(operationId) {
    return opIndex.get(operationId)?.resource ?? null;
  }
  function suggestOperation(name) {
    return suggestClosest(name, allOperationIds);
  }
  function checkField(resourceFields, fieldDefs, ref, value, errors) {
    const base = baseFieldName(ref);
    if (!base) return;
    if (base === "extdata") return;
    if (!resourceFields.includes(base)) {
      const suggestion = suggestClosest(base, resourceFields);
      errors.push({
        field: base,
        message: `Unknown field "${base}".` + (suggestion ? ` Did you mean "${suggestion}"?` : ""),
        ...suggestion ? { suggestion } : {}
      });
      return;
    }
    const def = fieldDefs[base];
    if (def && def.enum && (typeof value === "string" || typeof value === "number")) {
      if (!Object.prototype.hasOwnProperty.call(def.enum, String(value))) {
        const valid = Object.entries(def.enum).map(([k, v]) => `${k}=${v}`).join(", ");
        errors.push({
          field: base,
          message: `Invalid value ${JSON.stringify(value)} for "${base}". Valid: ${valid}.`
        });
      }
    }
  }
  function validate(operationId, input) {
    const errors = [];
    const entry = opIndex.get(operationId);
    if (!entry) {
      const suggestion = suggestOperation(operationId);
      errors.push({
        message: `Unknown operation "${operationId}".` + (suggestion ? ` Did you mean "${suggestion}"?` : ""),
        ...suggestion ? { suggestion } : {}
      });
      return { valid: false, errors };
    }
    const data = input && typeof input === "object" ? input : {};
    const resourceEntry = schemaMap[entry.resource];
    const resourceFields = resourceEntry ? Object.keys(resourceEntry.fields) : null;
    const fieldDefs = resourceEntry ? resourceEntry.fields : {};
    const isListLike = /^(list|count)/.test(operationId);
    if (isListLike && Object.prototype.hasOwnProperty.call(data, "filter")) {
      errors.push({
        field: "filter",
        message: 'Use "filters" (plural) rather than "filter" \u2014 it also matches GIN-indexed foreign-key fields (project, account, ticket).',
        suggestion: "filters"
      });
    }
    if (!resourceFields) {
      return { valid: errors.length === 0, errors };
    }
    if (isListLike) {
      for (const key of ["filters", "filter"]) {
        const filterObj = data[key];
        if (filterObj && typeof filterObj === "object" && !Array.isArray(filterObj)) {
          for (const [field, value] of Object.entries(filterObj)) {
            checkField(resourceFields, fieldDefs, field, value, errors);
          }
        }
      }
      const sel = data.fields;
      const selValues = Array.isArray(sel) ? sel : sel && typeof sel === "object" ? Object.values(sel) : [];
      for (const ref of selValues) checkField(resourceFields, fieldDefs, ref, void 0, errors);
      const sort = data.sort;
      const sortValues = Array.isArray(sort) ? sort : typeof sort === "string" ? sort.split(",") : [];
      for (const ref of sortValues) checkField(resourceFields, fieldDefs, sortFieldName(ref), void 0, errors);
    } else {
      const payload = data.body && typeof data.body === "object" && !Array.isArray(data.body) ? data.body : data.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : data;
      for (const [key, value] of Object.entries(payload)) {
        if (CONTROL_KEYS.has(key) || QUERY_DIRECTIVES.has(key)) continue;
        if (entry.operation.parameterNames?.path?.includes(key)) continue;
        if (entry.operation.parameterNames?.query?.includes(key)) continue;
        if (entry.operation.parameterNames?.header?.includes(key)) continue;
        checkField(resourceFields, fieldDefs, key, value, errors);
      }
      if (/^create/i.test(operationId)) {
        for (const field of REQUIRED_CREATE_FIELDS[entry.resource] || []) {
          if (!Object.prototype.hasOwnProperty.call(payload, field) || payload[field] == null) {
            errors.push({
              field,
              message: `Missing required field "${field}" for ${entry.resource} \u2014 it is NOT NULL with no default, so the API rejects a create without it.`,
              suggestion: field
            });
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
  return Object.freeze({
    resources,
    describe,
    fields,
    operations,
    operationIds,
    resourceForOperation,
    suggestOperation,
    validate
  });
}

// ../../../zeyos/client/src/runtime/token-store.js
function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function normalizeTokenSet(input) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const accessToken = input.accessToken ?? input.access_token ?? null;
  const refreshToken = input.refreshToken ?? input.refresh_token ?? null;
  if (!accessToken && !refreshToken) {
    return null;
  }
  const nowSeconds = Math.floor(Date.now() / 1e3);
  const obtainedAt = toNumber(input.obtainedAt ?? input.obtained_at) ?? nowSeconds;
  const expiresIn = toNumber(input.expiresIn ?? input.expires_in);
  const refreshTokenExpiresIn = toNumber(input.refreshTokenExpiresIn ?? input.refresh_token_expires_in);
  const expiresAt = toNumber(input.expiresAt ?? input.expires_at) ?? (expiresIn != null ? obtainedAt + expiresIn : null);
  const refreshTokenExpiresAt = toNumber(input.refreshTokenExpiresAt ?? input.refresh_token_expires_at) ?? (refreshTokenExpiresIn != null ? obtainedAt + refreshTokenExpiresIn : null);
  return {
    tokenType: input.tokenType ?? input.token_type ?? "Bearer",
    accessToken,
    refreshToken,
    expiresIn,
    refreshTokenExpiresIn,
    obtainedAt,
    expiresAt,
    refreshTokenExpiresAt
  };
}
function tokenResponseToTokenSet(tokenResponse) {
  return normalizeTokenSet(tokenResponse);
}
var MemoryTokenStore = class {
  /** @param {TokenSetInput|null} [initialToken] */
  constructor(initialToken = null) {
    this.token = normalizeTokenSet(initialToken);
  }
  /** @returns {Promise<TokenSet|null>} */
  async get() {
    return this.token;
  }
  /** @param {TokenSetInput|null} token */
  async set(token) {
    this.token = normalizeTokenSet(token);
  }
};

// ../../../zeyos/client/src/runtime/client.js
var DEFAULT_RETRY = Object.freeze({
  maxRetries: 2,
  retryOn: Object.freeze([429, 503]),
  baseDelayMs: 300,
  maxDelayMs: 1e4
});
function normalizeRetry(retry) {
  if (retry === false || retry === null) {
    return { maxRetries: 0, retryOn: /* @__PURE__ */ new Set(), baseDelayMs: 0, maxDelayMs: 0 };
  }
  const cfg = retry && typeof retry === "object" ? retry : {};
  const retryOn = Array.isArray(cfg.retryOn) ? cfg.retryOn : DEFAULT_RETRY.retryOn;
  return {
    maxRetries: Number.isInteger(cfg.maxRetries) && cfg.maxRetries >= 0 ? cfg.maxRetries : DEFAULT_RETRY.maxRetries,
    retryOn: new Set(retryOn),
    baseDelayMs: Number(cfg.baseDelayMs) > 0 ? Number(cfg.baseDelayMs) : DEFAULT_RETRY.baseDelayMs,
    maxDelayMs: Number(cfg.maxDelayMs) > 0 ? Number(cfg.maxDelayMs) : DEFAULT_RETRY.maxDelayMs
  };
}
function abortableDelay(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error("Aborted"));
  }
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Aborted"));
    }
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}
function backoffDelay(attempt, retryConfig) {
  const exp = retryConfig.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * retryConfig.baseDelayMs;
  return Math.min(retryConfig.maxDelayMs, exp + jitter);
}
function computeRetryDelay(response, attempt, retryConfig) {
  const header = response.headers?.["retry-after"];
  const trimmedHeader = typeof header === "string" ? header.trim() : header;
  if (trimmedHeader != null && trimmedHeader !== "") {
    const seconds = Number(trimmedHeader);
    if (Number.isFinite(seconds)) {
      return Math.min(retryConfig.maxDelayMs, Math.max(0, seconds * 1e3));
    }
    const dateMs = Date.parse(trimmedHeader);
    if (Number.isFinite(dateMs)) {
      return Math.min(retryConfig.maxDelayMs, Math.max(0, dateMs - Date.now()));
    }
  }
  return backoffDelay(attempt, retryConfig);
}
function isReadOperation(operation) {
  const method = operation?.method;
  if (method === "GET" || method === "HEAD") {
    return true;
  }
  return /^(list|count|search|exists|get)/i.test(operation?.operationId || "");
}
function summarizeErrorBody(body, maxLength = 200) {
  let text = "";
  if (typeof body === "string") {
    text = body.trim();
  } else if (body && typeof body === "object") {
    const candidate = body.message ?? body.error_description ?? body.error ?? body.detail ?? body.title;
    if (typeof candidate === "string" && candidate.trim()) {
      text = candidate.trim();
    } else {
      try {
        text = JSON.stringify(body);
      } catch {
        text = "";
      }
    }
  }
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}\u2026` : text;
}
async function fetchWithTimeout(httpRequestImpl, requestArgs, externalSignal, timeoutMs) {
  if (!(timeoutMs > 0)) {
    return httpRequestImpl({ ...requestArgs, signal: externalSignal });
  }
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await httpRequestImpl({ ...requestArgs, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      timeoutError.code = "ETIMEDOUT";
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", onExternalAbort);
  }
}
var AUTH_SCHEME_MAP = Object.freeze({
  oauth: "bearer",
  token: "bearer",
  session: "session",
  basic: "basic"
});
var PLATFORM_PRESETS = Object.freeze({
  live: "https://cloud.zeyos.com"
});
var VALID_AUTH_MODES = /* @__PURE__ */ new Set(["auto", "oauth", "session", "none"]);
var RESERVED_INPUT_KEYS = new Set(REQUEST_CONTROL_KEYS);
var OBJECT_CONTROL_KEYS2 = new Set(OBJECT_CONTROL_KEYS);
function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
function isPlainObject2(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
function cloneValue(value) {
  if (!Array.isArray(value) && !isPlainObject2(value)) {
    return value;
  }
  return structuredClone(value);
}
function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}
function toBase64(value) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(value);
  }
  throw new Error("No base64 encoder available in this runtime.");
}
function normalizeAuthMode(value, fallback = "auto") {
  if (value && VALID_AUTH_MODES.has(value)) {
    return value;
  }
  return fallback;
}
function parsePlatformUrl(value) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    const instance = segments.length === 1 ? decodeURIComponent(segments[0]) : null;
    return {
      origin: parsed.origin,
      instance
    };
  } catch {
    return null;
  }
}
function normalizePlatform(platform) {
  if (!platform) {
    return null;
  }
  if (typeof platform === "string") {
    if (PLATFORM_PRESETS[platform]) {
      return {
        origin: PLATFORM_PRESETS[platform],
        instance: null
      };
    }
    const parsed = parsePlatformUrl(platform);
    if (parsed) {
      return parsed;
    }
    return {
      origin: platform,
      instance: null
    };
  }
  if (!isObject(platform)) {
    return null;
  }
  const preset = typeof platform.preset === "string" ? platform.preset : null;
  const directOrigin = typeof platform.origin === "string" ? platform.origin : null;
  const directUrl = typeof platform.url === "string" ? platform.url : null;
  const parsedUrl = directUrl ? parsePlatformUrl(directUrl) : null;
  return {
    origin: directOrigin ?? parsedUrl?.origin ?? (preset && PLATFORM_PRESETS[preset] ? PLATFORM_PRESETS[preset] : null),
    instance: typeof platform.instance === "string" ? platform.instance : parsedUrl?.instance ?? null
  };
}
function mergeHeaders(...sources) {
  const merged = new Headers();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const headers = source instanceof Headers ? source : new Headers(source);
    for (const [key, value] of headers.entries()) {
      merged.set(key, value);
    }
  }
  return merged;
}
function isSuccessfulHttpStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 400;
}
function securitySchemesFromOperation(operation) {
  const security = Array.isArray(operation.security) ? operation.security : [];
  if (security.length === 0) {
    return ["none"];
  }
  const schemes = [];
  for (const requirement of security) {
    const keys = Object.keys(requirement || {});
    if (keys.length === 0) {
      if (!schemes.includes("none")) {
        schemes.push("none");
      }
      continue;
    }
    for (const key of keys) {
      const mapped = AUTH_SCHEME_MAP[key];
      if (mapped && !schemes.includes(mapped)) {
        schemes.push(mapped);
      }
    }
  }
  return schemes.length > 0 ? schemes : ["none"];
}
function shouldInferBody(operation, input) {
  if (!Array.isArray(operation.requestContentTypes) || operation.requestContentTypes.length === 0) {
    return false;
  }
  for (const key of RESERVED_INPUT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      continue;
    }
    if (OBJECT_CONTROL_KEYS2.has(key) && !isObject(input[key])) {
      continue;
    }
    return false;
  }
  return true;
}
function prepareOperationInput(operation, inputValue) {
  const input = isObject(inputValue) ? inputValue : {};
  const pathParams = isObject(input.path) ? { ...input.path } : {};
  const query = isObject(input.query) ? { ...input.query } : {};
  const headers = isObject(input.headers) ? { ...input.headers } : {};
  const consumedInputKeys = new Set(RESERVED_INPUT_KEYS);
  for (const key of OBJECT_CONTROL_KEYS2) {
    if (Object.prototype.hasOwnProperty.call(input, key) && !isObject(input[key])) {
      consumedInputKeys.delete(key);
    }
  }
  for (const name of operation.parameterNames.path) {
    if (!Object.prototype.hasOwnProperty.call(pathParams, name) && Object.prototype.hasOwnProperty.call(input, name)) {
      pathParams[name] = input[name];
    }
    if (Object.prototype.hasOwnProperty.call(input, name)) {
      consumedInputKeys.add(name);
    }
  }
  for (const name of operation.parameterNames.query) {
    if (!Object.prototype.hasOwnProperty.call(query, name) && Object.prototype.hasOwnProperty.call(input, name)) {
      query[name] = input[name];
    }
    if (Object.prototype.hasOwnProperty.call(input, name)) {
      consumedInputKeys.add(name);
    }
  }
  for (const name of operation.parameterNames.header) {
    if (!Object.prototype.hasOwnProperty.call(headers, name) && Object.prototype.hasOwnProperty.call(input, name)) {
      headers[name] = input[name];
    }
    if (Object.prototype.hasOwnProperty.call(input, name)) {
      consumedInputKeys.add(name);
    }
  }
  let body;
  if (Object.prototype.hasOwnProperty.call(input, "body")) {
    body = input.body;
  } else if (Object.prototype.hasOwnProperty.call(input, "data")) {
    body = input.data;
  } else if (shouldInferBody(operation, input)) {
    body = {};
    for (const [key, value] of Object.entries(input)) {
      if (!consumedInputKeys.has(key)) {
        body[key] = value;
      }
    }
    if (Object.keys(body).length === 0) {
      body = void 0;
    }
  } else if (Array.isArray(operation.requestContentTypes) && operation.requestContentTypes.length > 0) {
    const collidingReservedKeys = [];
    for (const key of RESERVED_INPUT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        collidingReservedKeys.push(key);
      }
    }
    const orphanedFields = Object.keys(input).filter((key) => !consumedInputKeys.has(key));
    if (orphanedFields.length > 0) {
      const operationLabel = operation.operationId || `${operation.method} ${operation.path}`;
      throw new ZeyosApiError(
        `${operationLabel}: payload field(s) ${orphanedFields.map((field) => `"${field}"`).join(", ")} would be dropped because the reserved key(s) ${collidingReservedKeys.map((key) => `"${key}"`).join(", ")} disabled body inference. Wrap payload fields in an explicit \`body: { ... }\` (or \`data: { ... }\`).`,
        {
          operationId: operation.operationId,
          method: operation.method,
          url: operation.path
        }
      );
    }
  }
  return {
    pathParams,
    query,
    headers,
    body,
    bodyType: input.bodyType,
    auth: input.auth,
    signal: input.signal,
    raw: input.raw,
    baseUrl: input.baseUrl
  };
}
function chooseBodyType(serviceKey, operation, prepared, fallbackBodyType) {
  const body = prepared.body;
  if (body == null) {
    return void 0;
  }
  const explicitType = prepared.bodyType ?? fallbackBodyType;
  if (explicitType) {
    return explicitType;
  }
  const contentTypes = operation.requestContentTypes || [];
  if ((serviceKey === "oauth2" || serviceKey === "legacyAuth") && contentTypes.includes("application/x-www-form-urlencoded")) {
    return "form";
  }
  if (contentTypes.includes("application/json")) {
    return "json";
  }
  if (contentTypes.includes("application/x-www-form-urlencoded")) {
    return "form";
  }
  return void 0;
}
function createApiError(response, { serviceKey, operation, method, url }) {
  const operationDescription = operation.operationId ? `${serviceKey}.${operation.operationId}` : `${serviceKey} request`;
  const detail = summarizeErrorBody(response.data);
  const message = `${operationDescription} failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
  return new ZeyosApiError(message, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body: response.data,
    method,
    url,
    operationId: operation.operationId,
    service: serviceKey
  });
}
function normalizeRequestAuth(auth) {
  if (!auth) {
    return {};
  }
  if (typeof auth === "string") {
    return { mode: auth };
  }
  return auth;
}
function getBasicCredentials({ body, requestAuth, oauthConfig }) {
  const bodyObject = isObject(body) ? body : {};
  const clientId = requestAuth.clientId ?? requestAuth.client_id ?? bodyObject.client_id ?? bodyObject.clientId ?? oauthConfig.clientId ?? oauthConfig.client_id;
  const clientSecret = requestAuth.clientSecret ?? requestAuth.client_secret ?? bodyObject.client_secret ?? bodyObject.clientSecret ?? oauthConfig.clientSecret ?? oauthConfig.client_secret;
  if (!clientId || !clientSecret) {
    return null;
  }
  return {
    clientId,
    clientSecret
  };
}
function resolveBaseUrl({ services, serviceKey, config, explicitBaseUrl }) {
  if (explicitBaseUrl) {
    return trimTrailingSlash(explicitBaseUrl);
  }
  if (isObject(config.baseUrls) && typeof config.baseUrls[serviceKey] === "string") {
    return trimTrailingSlash(config.baseUrls[serviceKey]);
  }
  const service = services[serviceKey];
  if (!service) {
    throw new Error(`Unknown service key: ${serviceKey}`);
  }
  const template = service.server?.urlTemplate || "";
  const defaults = isObject(service.server?.defaultVariables) ? service.server.defaultVariables : {};
  const platform = normalizePlatform(config.platform);
  const platformInstance = platform?.instance ?? config.instance ?? defaults.INSTANCE;
  if (platform?.origin) {
    const pathTemplate = service.server?.basePathTemplate || "";
    const pathVariables = {
      ...defaults,
      INSTANCE: platformInstance
    };
    const resolvedPath = pathTemplate.replace(/\{([^}]+)\}/g, (_, token) => {
      if (!Object.prototype.hasOwnProperty.call(pathVariables, token)) {
        return `{${token}}`;
      }
      return encodeURIComponent(String(pathVariables[token]));
    });
    const normalizedOrigin = trimTrailingSlash(platform.origin);
    const normalizedPath = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
    return trimTrailingSlash(`${normalizedOrigin}${normalizedPath}`);
  }
  const variables = {
    ...defaults,
    INSTANCE: platformInstance
  };
  const resolved = template.replace(/\{([^}]+)\}/g, (_, token) => {
    if (!Object.prototype.hasOwnProperty.call(variables, token)) {
      return `{${token}}`;
    }
    return encodeURIComponent(String(variables[token]));
  });
  return trimTrailingSlash(resolved);
}
function resolveAuthCandidates({ mode, schemes, tokenSet, sessionEnabled }) {
  const has = (scheme) => schemes.includes(scheme);
  if (mode === "none") {
    return [{ type: "none" }];
  }
  if (mode === "oauth") {
    if (has("basic")) {
      return [{ type: "basic" }];
    }
    if (has("bearer")) {
      return [{ type: "bearer" }];
    }
    if (has("none")) {
      return [{ type: "none" }];
    }
    throw new Error("OAuth mode cannot satisfy the operation security requirements.");
  }
  if (mode === "session") {
    if (has("session")) {
      return [{ type: "session" }];
    }
    if (has("none")) {
      return [{ type: "none" }];
    }
    throw new Error("Session mode cannot satisfy the operation security requirements.");
  }
  const candidates = [];
  if (has("basic")) {
    candidates.push({ type: "basic" });
  }
  if (has("bearer") && tokenSet?.accessToken) {
    candidates.push({ type: "bearer" });
  }
  if (has("session") && sessionEnabled) {
    candidates.push({ type: "session" });
  }
  if (candidates.length === 0) {
    if (has("bearer")) {
      candidates.push({ type: "bearer" });
    } else if (has("session") && sessionEnabled) {
      candidates.push({ type: "session" });
    } else {
      candidates.push({ type: "none" });
    }
  }
  return candidates;
}
function canRefreshAccessToken({ mode, operation, tokenSet, oauthConfig }) {
  if (mode !== "auto" && mode !== "oauth") {
    return false;
  }
  if (oauthConfig.autoRefresh === false) {
    return false;
  }
  if (!tokenSet?.refreshToken) {
    return false;
  }
  if (operation.operationId === "getToken") {
    return false;
  }
  return Boolean(oauthConfig.clientId && oauthConfig.clientSecret);
}
function isAccessTokenExpired(tokenSet, skewSeconds = 60) {
  if (!tokenSet?.accessToken || tokenSet.expiresAt == null) {
    return false;
  }
  const expiresAt = Number(tokenSet.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1e3);
  return expiresAt <= now + skewSeconds;
}
function createZeyosClient(rawConfig = {}) {
  const config = isObject(rawConfig) ? rawConfig : {};
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is required (pass config.fetch or run in an environment with global fetch).");
  }
  const authConfig = isObject(config.auth) ? config.auth : {};
  const oauthConfig = isObject(authConfig.oauth) ? authConfig.oauth : {};
  const sessionConfig = isObject(authConfig.session) ? authConfig.session : {};
  const defaultMode = normalizeAuthMode(authConfig.mode, "auto");
  const sessionEnabled = sessionConfig.enabled !== false;
  const sessionCredentials = sessionConfig.credentials ?? "include";
  const providedTokenStore = oauthConfig.tokenStore;
  const tokenStore = providedTokenStore && typeof providedTokenStore.get === "function" && typeof providedTokenStore.set === "function" ? providedTokenStore : new MemoryTokenStore(oauthConfig.token ?? null);
  const defaultHeaders = isObject(config.headers) ? config.headers : {};
  const retryConfig = normalizeRetry(config.retry);
  const defaultTimeoutMs = Number(config.timeoutMs) > 0 ? Number(config.timeoutMs) : 0;
  const defaultRetryOnNetworkError = typeof config.retryOnNetworkError === "boolean" ? config.retryOnNetworkError : void 0;
  const schemaApi = createSchema({ services: SERVICES, schema: SCHEMA });
  const validateByDefault = config.validate === true;
  const operationLookup = /* @__PURE__ */ new Map();
  for (const [serviceKey, service] of Object.entries(SERVICES)) {
    for (const operation of service.operations) {
      operationLookup.set(`${serviceKey}.${operation.operationId}`, operation);
    }
  }
  let refreshInFlight = null;
  async function getTokenSet() {
    return normalizeTokenSet(await tokenStore.get());
  }
  async function setTokenSet(tokenSet) {
    await tokenStore.set(normalizeTokenSet(tokenSet));
  }
  async function clearTokenSet() {
    await tokenStore.set(null);
  }
  async function getSessionCookieHeader() {
    const cookieSource = sessionConfig.cookie;
    const rawCookie = typeof cookieSource === "function" ? await cookieSource() : cookieSource;
    if (!rawCookie) {
      return null;
    }
    const cookieValue = String(rawCookie);
    if (cookieValue.includes("=")) {
      return cookieValue;
    }
    return `ZEYOSID=${cookieValue}`;
  }
  function resolveNetworkRetry(operation, requestOptions) {
    const explicit = requestOptions?.retryOnNetworkError ?? defaultRetryOnNetworkError;
    if (explicit === true) return true;
    if (explicit === false) return false;
    return isReadOperation(operation);
  }
  async function sendRequestOnce({ serviceKey, operation, prepared, requestAuth, tokenSet, candidate, requestOptions }) {
    const body = cloneValue(prepared.body);
    const authHeaders = {};
    let credentials;
    if (candidate.type === "bearer") {
      const accessToken = requestAuth.accessToken ?? requestAuth.access_token ?? tokenSet?.accessToken;
      if (!accessToken) {
        throw new Error("Missing access token for bearer-authenticated request.");
      }
      authHeaders.authorization = `Bearer ${accessToken}`;
    }
    if (candidate.type === "basic") {
      const credentialsPair = getBasicCredentials({ body, requestAuth, oauthConfig });
      if (!credentialsPair) {
        throw new Error("Missing client_id/client_secret for basic-authenticated request.");
      }
      authHeaders.authorization = `Basic ${toBase64(`${credentialsPair.clientId}:${credentialsPair.clientSecret}`)}`;
      if (isObject(body)) {
        if (!Object.prototype.hasOwnProperty.call(body, "client_id")) {
          body.client_id = credentialsPair.clientId;
        }
        if (!Object.prototype.hasOwnProperty.call(body, "client_secret")) {
          body.client_secret = credentialsPair.clientSecret;
        }
      }
    }
    if (candidate.type === "session") {
      credentials = sessionCredentials;
      const cookieHeader = await getSessionCookieHeader();
      if (cookieHeader) {
        authHeaders.cookie = cookieHeader;
      }
    }
    const bodyType = chooseBodyType(serviceKey, operation, { ...prepared, body }, requestOptions?.bodyType);
    const headers = mergeHeaders(defaultHeaders, prepared.headers, authHeaders);
    if (!headers.has("accept")) {
      headers.set("accept", "application/json, text/plain;q=0.9, */*;q=0.8");
    }
    const url = buildUrl(
      resolveBaseUrl({ services: SERVICES, serviceKey, config, explicitBaseUrl: prepared.baseUrl ?? requestOptions?.baseUrl }),
      operation.path,
      prepared.pathParams,
      prepared.query
    );
    const signal = prepared.signal ?? requestOptions?.signal;
    const timeoutMs = Number(requestOptions?.timeoutMs ?? defaultTimeoutMs) || 0;
    const networkRetryAllowed = resolveNetworkRetry(operation, requestOptions);
    const requestArgs = { fetchImpl, url, method: operation.method, headers, body, bodyType, credentials };
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await fetchWithTimeout(httpRequest, requestArgs, signal, timeoutMs);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        if (!networkRetryAllowed || attempt >= retryConfig.maxRetries) {
          throw error;
        }
        await abortableDelay(backoffDelay(attempt, retryConfig), signal);
        continue;
      }
      if (attempt >= retryConfig.maxRetries || !retryConfig.retryOn.has(response.status)) {
        break;
      }
      await abortableDelay(computeRetryDelay(response, attempt, retryConfig), signal);
    }
    if (!isSuccessfulHttpStatus(response.status)) {
      throw createApiError(response, {
        serviceKey,
        operation,
        method: operation.method,
        url
      });
    }
    return {
      ...response,
      data: operation.method === "HEAD" ? true : response.data
    };
  }
  async function refreshAccessToken(currentTokenSet, requestAuth = {}, requestOptions = {}) {
    const refreshToken2 = requestAuth.refreshToken ?? requestAuth.refresh_token ?? currentTokenSet?.refreshToken;
    if (!refreshToken2) {
      return null;
    }
    const credentials = getBasicCredentials({ body: {}, requestAuth, oauthConfig });
    if (!credentials) {
      return null;
    }
    const tokenOperation = operationLookup.get("oauth2.getToken");
    if (!tokenOperation) {
      return null;
    }
    const prepared = {
      pathParams: {},
      query: {},
      headers: {},
      body: {
        grant_type: "refresh_token",
        refresh_token: refreshToken2,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      },
      bodyType: "form",
      signal: requestOptions.signal,
      baseUrl: requestOptions.baseUrl
    };
    const response = await sendRequestOnce({
      serviceKey: "oauth2",
      operation: tokenOperation,
      prepared,
      requestAuth,
      tokenSet: currentTokenSet,
      candidate: { type: "basic" },
      requestOptions: { ...requestOptions, bodyType: "form" }
    });
    const nextTokenSet = tokenResponseToTokenSet(response.data);
    if (!nextTokenSet) {
      return null;
    }
    if (!nextTokenSet.refreshToken && currentTokenSet?.refreshToken) {
      nextTokenSet.refreshToken = currentTokenSet.refreshToken;
    }
    await tokenStore.set(nextTokenSet);
    return nextTokenSet;
  }
  function refreshAccessTokenOnce(currentTokenSet, requestAuth, requestOptions) {
    if (refreshInFlight) {
      return refreshInFlight;
    }
    refreshInFlight = Promise.resolve().then(() => refreshAccessToken(currentTokenSet, requestAuth, requestOptions)).finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }
  async function executeOperation({ serviceKey, operation, prepared, requestOptions = {} }) {
    if (requestOptions.dryRun || prepared.dryRun) {
      const baseUrl = resolveBaseUrl({
        services: SERVICES,
        serviceKey,
        config,
        explicitBaseUrl: prepared.baseUrl ?? requestOptions.baseUrl
      });
      const url = buildUrl(baseUrl, operation.path, prepared.pathParams, prepared.query);
      const bodyType = chooseBodyType(serviceKey, operation, prepared, requestOptions?.bodyType);
      return {
        dryRun: true,
        service: serviceKey,
        operationId: operation.operationId,
        method: operation.method,
        url,
        path: operation.path,
        pathParams: prepared.pathParams,
        query: prepared.query,
        headers: prepared.headers,
        body: prepared.body,
        bodyType
      };
    }
    const requestAuth = normalizeRequestAuth(prepared.auth ?? requestOptions.auth);
    const mode = normalizeAuthMode(requestAuth.mode, defaultMode);
    const schemes = securitySchemesFromOperation(operation);
    let tokenSet = await getTokenSet();
    if (schemes.includes("bearer") && isAccessTokenExpired(tokenSet) && canRefreshAccessToken({ mode, operation, tokenSet, oauthConfig })) {
      try {
        const refreshed = await refreshAccessTokenOnce(tokenSet, requestAuth, requestOptions);
        if (refreshed?.accessToken) {
          tokenSet = refreshed;
        }
      } catch {
      }
    }
    const candidates = resolveAuthCandidates({
      mode,
      schemes,
      tokenSet,
      sessionEnabled
    });
    const raw = requestOptions.raw ?? prepared.raw ?? false;
    let lastError;
    for (const candidate of candidates) {
      try {
        const response = await sendRequestOnce({
          serviceKey,
          operation,
          prepared,
          requestAuth,
          tokenSet,
          candidate,
          requestOptions
        });
        return raw ? response : response.data;
      } catch (error) {
        if (!(error instanceof ZeyosApiError) || error.status !== 401) {
          throw error;
        }
        if (candidate.type === "bearer" && canRefreshAccessToken({ mode, operation, tokenSet, oauthConfig })) {
          try {
            const refreshed = await refreshAccessTokenOnce(tokenSet, requestAuth, requestOptions);
            if (refreshed?.accessToken) {
              tokenSet = refreshed;
              const retryResponse = await sendRequestOnce({
                serviceKey,
                operation,
                prepared,
                requestAuth,
                tokenSet,
                candidate,
                requestOptions
              });
              return raw ? retryResponse : retryResponse.data;
            }
          } catch (refreshError) {
            lastError = refreshError;
            continue;
          }
        }
        lastError = error;
      }
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error("Unable to execute request due to missing authentication candidates.");
  }
  function bindService(serviceKey) {
    const service = SERVICES[serviceKey];
    if (!service) {
      return Object.freeze({});
    }
    const namespace = {};
    const operationIds = service.operations.map((operation) => operation.operationId);
    for (const operation of service.operations) {
      namespace[operation.operationId] = async (input, requestOptions) => {
        if (validateByDefault || requestOptions?.validate === true) {
          const result = schemaApi.validate(operation.operationId, input);
          if (!result.valid) {
            throw new ZeyosValidationError(
              `${operation.operationId}: ${result.errors.map((entry) => entry.message).join(" ")}`,
              { operationId: operation.operationId, errors: result.errors }
            );
          }
        }
        const prepared = prepareOperationInput(operation, input);
        return executeOperation({ serviceKey, operation, prepared, requestOptions });
      };
    }
    return new Proxy(Object.freeze(namespace), {
      get(target, prop, receiver) {
        if (typeof prop !== "string" || prop === "then" || prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        return async () => {
          const suggestion = suggestClosest(prop, operationIds);
          throw new ZeyosApiError(
            `Unknown operation '${serviceKey}.${prop}'.` + (suggestion ? ` Did you mean '${suggestion}'?` : " Use client.schema.operationIds() to list valid operations."),
            { operationId: prop, service: serviceKey }
          );
        };
      }
    });
  }
  async function request(input = {}, requestOptions = {}) {
    if (!isObject(input)) {
      throw new Error("client.request input must be an object.");
    }
    const serviceKey = input.service;
    if (!serviceKey || typeof serviceKey !== "string") {
      throw new Error("client.request requires a service key.");
    }
    if (input.operationId) {
      const operation2 = operationLookup.get(`${serviceKey}.${input.operationId}`);
      if (!operation2) {
        const candidates = (SERVICES[serviceKey]?.operations ?? []).map((entry) => entry.operationId);
        const suggestion = suggestClosest(input.operationId, candidates);
        throw new ZeyosApiError(
          `Unknown operation: ${serviceKey}.${input.operationId}.` + (suggestion ? ` Did you mean '${suggestion}'?` : ""),
          { operationId: input.operationId, service: serviceKey }
        );
      }
      const prepared2 = {
        pathParams: isObject(input.pathParams) ? input.pathParams : {},
        query: isObject(input.query) ? input.query : {},
        headers: isObject(input.headers) ? input.headers : {},
        body: input.body,
        bodyType: input.bodyType,
        auth: input.auth,
        signal: input.signal,
        raw: input.raw,
        baseUrl: input.baseUrl
      };
      return executeOperation({ serviceKey, operation: operation2, prepared: prepared2, requestOptions });
    }
    if (!input.path || !input.method) {
      throw new Error("client.request requires method and path when operationId is not provided.");
    }
    const operation = {
      operationId: "request",
      method: String(input.method).toUpperCase(),
      path: String(input.path),
      security: Array.isArray(input.security) ? input.security : [],
      requestContentTypes: Array.isArray(input.requestContentTypes) ? input.requestContentTypes : ["application/json"],
      parameterNames: {
        path: [],
        query: [],
        header: []
      }
    };
    const prepared = {
      pathParams: isObject(input.pathParams) ? input.pathParams : {},
      query: isObject(input.query) ? input.query : {},
      headers: isObject(input.headers) ? input.headers : {},
      body: input.body,
      bodyType: input.bodyType,
      auth: input.auth,
      signal: input.signal,
      raw: input.raw,
      baseUrl: input.baseUrl
    };
    return executeOperation({ serviceKey, operation, prepared, requestOptions });
  }
  const api = bindService("api");
  const oauth2Operations = bindService("oauth2");
  const legacyAuth = bindService("legacyAuth");
  async function* paginate(operationId, input = {}, opts = {}) {
    const op = operationLookup.get(`api.${operationId}`);
    if (!op) {
      const candidates = (SERVICES.api?.operations ?? []).map((entry) => entry.operationId);
      const suggestion = suggestClosest(operationId, candidates);
      throw new ZeyosApiError(
        `Unknown list operation: api.${operationId}.` + (suggestion ? ` Did you mean '${suggestion}'?` : ""),
        { operationId, service: "api" }
      );
    }
    const requested = Number(opts.pageSize) > 0 ? Number(opts.pageSize) : Number(input.limit) > 0 ? Number(input.limit) : 1e3;
    const pageSize = Math.min(requested, 1e4);
    const max = Number(opts.max) > 0 ? Number(opts.max) : Infinity;
    let offset = Number(input.offset) > 0 ? Number(input.offset) : 0;
    let yielded = 0;
    for (; ; ) {
      const page = await api[operationId]({ ...input, limit: pageSize, offset }, opts.requestOptions);
      const rows = Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : [];
      for (const row of rows) {
        yield row;
        yielded += 1;
        if (yielded >= max) {
          return;
        }
      }
      if (rows.length < pageSize) {
        return;
      }
      offset += pageSize;
    }
  }
  async function collect(operationId, input = {}, opts = {}) {
    const out = [];
    for await (const row of paginate(operationId, input, opts)) {
      out.push(row);
    }
    return out;
  }
  function buildAuthorizationUrl(options = {}) {
    const clientId = options.clientId ?? options.client_id ?? oauthConfig.clientId;
    const redirectUri = options.redirectUri ?? options.redirect_uri;
    if (!clientId) {
      throw new Error("buildAuthorizationUrl requires clientId (or auth.oauth.clientId in client config).");
    }
    if (!redirectUri) {
      throw new Error("buildAuthorizationUrl requires redirectUri.");
    }
    const query = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: options.scope ?? options.options?.scope,
      response_mode: options.responseMode ?? options.response_mode,
      code_challenge: options.codeChallenge ?? options.code_challenge,
      code_challenge_method: options.codeChallengeMethod ?? options.code_challenge_method,
      state: options.state
    };
    if (query.code_challenge && !query.code_challenge_method) {
      query.code_challenge_method = "S256";
    }
    return buildUrl(
      resolveBaseUrl({ services: SERVICES, serviceKey: "oauth2", config, explicitBaseUrl: options.baseUrl }),
      "/authorize",
      {},
      query
    );
  }
  function parseAuthorizationCallback(callbackUrl) {
    const url = callbackUrl instanceof URL ? callbackUrl : (() => {
      try {
        return new URL(String(callbackUrl));
      } catch {
        return new URL(String(callbackUrl), "http://localhost");
      }
    })();
    const params = url.searchParams;
    return {
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
      errorUri: params.get("error_uri"),
      isError: params.has("error")
    };
  }
  async function storeTokenResponse(tokenResponse, store = true) {
    const tokenSet = tokenResponseToTokenSet(tokenResponse);
    if (store && tokenSet) {
      await tokenStore.set(tokenSet);
    }
    return tokenSet || tokenResponse;
  }
  async function exchangeAuthorizationCode(options = {}, requestOptions = {}) {
    const clientId = options.clientId ?? options.client_id ?? oauthConfig.clientId;
    const clientSecret = options.clientSecret ?? options.client_secret ?? oauthConfig.clientSecret;
    const code = options.code;
    if (!code) {
      throw new Error("exchangeAuthorizationCode requires code.");
    }
    const tokenResponse = await request(
      {
        service: "oauth2",
        operationId: "getToken",
        body: {
          grant_type: "authorization_code",
          code,
          code_verifier: options.codeVerifier ?? options.code_verifier,
          redirect_uri: options.redirectUri ?? options.redirect_uri,
          client_id: clientId,
          client_secret: clientSecret
        },
        auth: {
          mode: "oauth",
          clientId,
          clientSecret
        },
        bodyType: "form",
        raw: false,
        baseUrl: options.baseUrl
      },
      requestOptions
    );
    return storeTokenResponse(tokenResponse, options.store !== false);
  }
  async function refreshToken(options = {}, requestOptions = {}) {
    const clientId = options.clientId ?? options.client_id ?? oauthConfig.clientId;
    const clientSecret = options.clientSecret ?? options.client_secret ?? oauthConfig.clientSecret;
    const tokenSet = await getTokenSet();
    const refreshTokenValue = options.refreshToken ?? options.refresh_token ?? tokenSet?.refreshToken;
    if (!refreshTokenValue) {
      throw new Error("refreshToken requires refreshToken or a stored token with refreshToken.");
    }
    const tokenResponse = await request(
      {
        service: "oauth2",
        operationId: "getToken",
        body: {
          grant_type: "refresh_token",
          refresh_token: refreshTokenValue,
          client_id: clientId,
          client_secret: clientSecret
        },
        auth: {
          mode: "oauth",
          clientId,
          clientSecret
        },
        bodyType: "form",
        baseUrl: options.baseUrl
      },
      requestOptions
    );
    return storeTokenResponse(tokenResponse, options.store !== false);
  }
  async function revokeToken(options = {}, requestOptions = {}) {
    const clientId = options.clientId ?? options.client_id ?? oauthConfig.clientId;
    const clientSecret = options.clientSecret ?? options.client_secret ?? oauthConfig.clientSecret;
    return request(
      {
        service: "oauth2",
        operationId: "revokeToken",
        body: {
          token: options.token,
          client_id: clientId,
          client_secret: clientSecret
        },
        auth: {
          mode: "oauth",
          clientId,
          clientSecret
        },
        bodyType: "form",
        baseUrl: options.baseUrl
      },
      requestOptions
    );
  }
  async function introspectToken(options = {}, requestOptions = {}) {
    const clientId = options.clientId ?? options.client_id ?? oauthConfig.clientId;
    const clientSecret = options.clientSecret ?? options.client_secret ?? oauthConfig.clientSecret;
    return request(
      {
        service: "oauth2",
        operationId: "introspectToken",
        body: {
          token: options.token,
          client_id: clientId,
          client_secret: clientSecret
        },
        auth: {
          mode: "oauth",
          clientId,
          clientSecret
        },
        bodyType: "form",
        baseUrl: options.baseUrl
      },
      requestOptions
    );
  }
  const oauth2 = Object.freeze({
    ...oauth2Operations,
    buildAuthorizationUrl,
    parseAuthorizationCallback,
    exchangeAuthorizationCode,
    refreshToken,
    revokeToken,
    introspectToken
  });
  const client = {
    api,
    oauth2,
    legacyAuth,
    request,
    paginate,
    collect,
    schema: schemaApi,
    auth: {
      getTokenSet,
      setTokenSet,
      clearTokenSet
    },
    metadata: {
      generatedAt: GENERATED.generatedAt,
      services: SERVICE_KEYS
    }
  };
  return Object.freeze(client);
}

// ../../../zeyos/client/src/runtime/okf.js
var OKF_VERSION = "0.1";
var GENERATED_FRONTMATTER_KEYS = Object.freeze([
  "type",
  "title",
  "description",
  "resource",
  "tags",
  "timestamp",
  "api_backed",
  "list_operation",
  "visibility_column"
]);
var RESERVED_BASENAMES = /* @__PURE__ */ new Set(["index.md", "log.md"]);
var VERB_RE = /^(list|get|create|update|delete|exists)/;
function parseConcept(content) {
  const text = String(content || "");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { frontmatter: {}, body: text };
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }
  return { frontmatter, body: text.slice(match[0].length) };
}
function isReserved(relPath) {
  const base = relPath.split("/").pop();
  return RESERVED_BASENAMES.has(base);
}
function validateOkfFiles(files) {
  const errors = [];
  let conceptCount = 0;
  for (const [relPath, content] of Object.entries(files || {})) {
    if (!relPath.endsWith(".md") || isReserved(relPath)) continue;
    conceptCount += 1;
    const { frontmatter } = parseConcept(content);
    if (!Object.keys(frontmatter).length) {
      errors.push({ path: relPath, message: "Missing YAML frontmatter." });
      continue;
    }
    if (!frontmatter.type) {
      errors.push({ path: relPath, message: "Frontmatter is missing the required `type` field." });
    }
  }
  return { valid: errors.length === 0, errors, conceptCount };
}
function conceptIdForResource(resource) {
  return `entities/${resource}`;
}
function groupOperations(services) {
  const byResource = /* @__PURE__ */ new Map();
  for (const service of Object.values(services || {})) {
    for (const op of service.operations || []) {
      const resource = resourceFromPath2(op.path);
      if (!resource) continue;
      if (!byResource.has(resource)) byResource.set(resource, {});
      const bucket = byResource.get(resource);
      const m = VERB_RE.exec(op.operationId);
      const key = m ? m[1] : op.operationId;
      if (!bucket[key]) bucket[key] = op.operationId;
    }
  }
  return byResource;
}
function resourceFromPath2(p) {
  if (typeof p !== "string") return null;
  for (const segment of p.split("/")) {
    if (segment && !segment.startsWith("{")) return segment;
  }
  return null;
}
function titleFromOps(ops, fallback) {
  const op = ops.list || ops.get;
  if (!op) return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  return op.replace(VERB_RE, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim() || fallback;
}
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function renderEntityDoc(name, entry, ops, hasDoc) {
  const link = (target) => hasDoc.has(target) ? `/entities/${target}.md` : null;
  const fields = Object.entries(entry.fields || {});
  const schemaRows = fields.map(([fname, def]) => {
    const fkCell = def.fk ? link(def.fk) ? `[${def.fk}](${link(def.fk)})` : def.fk : "\u2014";
    const enumCell = def.enum ? Object.entries(def.enum).map(([k, v]) => `${k}=${v}`).join(", ") : "\u2014";
    return `| \`${fname}\` | ${def.type || "unknown"} | ${def.indexed ? "yes" : "\u2014"} | ${fkCell} | ${enumCell} |`;
  });
  const schema = `# Schema

| Column | Type | Indexed | FK | Enum |
|---|---|---|---|---|
${schemaRows.join("\n")}`;
  const fks = fields.filter(([, d]) => d.fk);
  const fkSection = fks.length ? `

# Foreign Keys

${fks.map(([f, d]) => `- \`${f}\` \u2192 ${link(d.fk) ? `[${d.fk}](${link(d.fk)})` : d.fk}`).join("\n")}` : "";
  const order = ["list", "get", "create", "update", "delete", "exists"];
  const opLines = order.filter((k) => ops[k]).map((k) => `- ${k}: \`${ops[k]}\``);
  const opSection = opLines.length ? `

# Operations

${opLines.join("\n")}` : "";
  const title = titleFromOps(ops, name);
  const fm = [
    "type: ZeyOS Entity",
    `title: ${title}`,
    `resource: zeyos://api/${name}`,
    "tags: [generated]",
    "api_backed: true"
  ];
  if (ops.list) fm.push(`list_operation: ${ops.list}`);
  fm.push(`visibility_column: ${Object.prototype.hasOwnProperty.call(entry.fields || {}, "visibility")}`);
  return `---
${fm.join("\n")}
---

${schema}${fkSection}${opSection}
`;
}
function buildOkf({ schema = SCHEMA, services = SERVICES } = {}) {
  const ops = groupOperations(services);
  const resources = Object.keys(schema).filter((r) => ops.has(r)).sort();
  const hasDoc = new Set(resources);
  const files = {};
  for (const name of resources) {
    files[`entities/${name}.md`] = renderEntityDoc(name, schema[name], ops.get(name) || {}, hasDoc);
  }
  const indexItems = resources.map((name) => `* [${titleFromOps(ops.get(name) || {}, name)}](${name}.md)`).join("\n");
  files["entities/index.md"] = `# Entities

${indexItems}
`;
  const signature = resources.map((r) => `${r}:${Object.keys(schema[r].fields || {}).join(",")}`).join("|");
  files["index.md"] = `---
okf_version: ${OKF_VERSION}
source_snapshot: ${fnv1a(signature)}
---

# ZeyOS Knowledge Bundle

* [Entities](entities/) - ${resources.length} API-backed entity concepts.
`;
  return files;
}
async function loadOkfBundle(dir) {
  const { readFile, readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const files = {};
  async function walk(current, prefix) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.name.endsWith(".md")) files[rel] = await readFile(abs, "utf8");
    }
  }
  await walk(dir, "");
  const concepts = {};
  for (const [rel, content] of Object.entries(files)) {
    if (isReserved(rel)) continue;
    concepts[rel.replace(/\.md$/, "")] = parseConcept(content);
  }
  let version = null;
  if (files["index.md"]) version = parseConcept(files["index.md"]).frontmatter.okf_version || null;
  return { version, files, concepts };
}
async function validateOkfBundle(dirOrFiles) {
  if (typeof dirOrFiles === "string") {
    const { files } = await loadOkfBundle(dirOrFiles);
    return validateOkfFiles(files);
  }
  return validateOkfFiles(dirOrFiles);
}

// ../../../zeyos/client/src/index.js
function normalizeListResult(result) {
  if (Array.isArray(result)) {
    return { data: result };
  }
  if (result != null && typeof result === "object") {
    const data = Array.isArray(result.data) ? result.data : [];
    const out = { data };
    if (typeof result.count === "number" && Number.isFinite(result.count)) {
      out.count = result.count;
    } else if (typeof result.count === "string" && result.count !== "") {
      const parsed = Number(result.count);
      if (Number.isFinite(parsed)) out.count = parsed;
    }
    return out;
  }
  return { data: [] };
}
function normalizeCountResult(result) {
  if (typeof result === "number") {
    return Number.isFinite(result) ? result : 0;
  }
  if (typeof result === "string" && result !== "") {
    const parsed = Number(result);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(result)) {
    return result.length;
  }
  if (result != null && typeof result === "object") {
    if (result.count != null) {
      const parsed = Number(result.count);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (Array.isArray(result.data)) {
      return result.data.length;
    }
  }
  return 0;
}
export {
  MemoryTokenStore,
  OKF_VERSION,
  ZeyosApiError,
  ZeyosValidationError,
  buildOkf,
  conceptIdForResource,
  createZeyosClient,
  loadOkfBundle,
  normalizeCountResult,
  normalizeListResult,
  normalizeTokenSet,
  suggestClosest,
  tokenResponseToTokenSet,
  validateOkfBundle,
  validateOkfFiles
};
