const prometheus = {
    "type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "OVERVIEW"}]}, {
        "type": "bullet_list",
        "content": [{
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {
                            "href": "https://prometheus.io/docs/introduction/overview/#what-is-prometheus",
                            "title": null
                        }
                    }],
                    "text": "What is Prometheus?"
                }]
            }, {
                "type": "bullet_list",
                "content": [{
                    "type": "list_item",
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "marks": [{
                                "type": "link",
                                "attrs": {
                                    "href": "https://prometheus.io/docs/introduction/overview/#features",
                                    "title": null
                                }
                            }],
                            "text": "Features"
                        }]
                    }]
                }, {
                    "type": "list_item",
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "marks": [{
                                "type": "link",
                                "attrs": {
                                    "href": "https://prometheus.io/docs/introduction/overview/#components",
                                    "title": null
                                }
                            }],
                            "text": "Components"
                        }]
                    }]
                }, {
                    "type": "list_item",
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "marks": [{
                                "type": "link",
                                "attrs": {
                                    "href": "https://prometheus.io/docs/introduction/overview/#architecture",
                                    "title": null
                                }
                            }],
                            "text": "Architecture"
                        }]
                    }]
                }]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {
                            "href": "https://prometheus.io/docs/introduction/overview/#when-does-it-fit",
                            "title": null
                        }
                    }],
                    "text": "When does it fit?"
                }]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {
                            "href": "https://prometheus.io/docs/introduction/overview/#when-does-it-not-fit",
                            "title": null
                        }
                    }],
                    "text": "When does it not fit?"
                }]
            }]
        }]
    }, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "What is Prometheus?"}]}, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "https://github.com/prometheus", "title": null}}],
            "text": "Prometheus"
        }, {
            "type": "text",
            "text": " is an open-source systems monitoring and alerting toolkit originally built at "
        }, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "http://soundcloud.com/", "title": null}}],
            "text": "SoundCloud"
        }, {
            "type": "text",
            "text": ". Since its inception in 2012, many companies and organizations have adopted Prometheus, and the project has a very active developer and user "
        }, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "https://prometheus.io/community", "title": null}}],
            "text": "community"
        }, {
            "type": "text",
            "text": ". It is now a standalone open source project and maintained independently of any company. To emphasize this, and to clarify the project's governance structure, Prometheus joined the "
        }, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "https://cncf.io/", "title": null}}],
            "text": "Cloud Native Computing Foundation"
        }, {"type": "text", "text": " in 2016 as the second hosted project, after "}, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "http://kubernetes.io/", "title": null}}],
            "text": "Kubernetes"
        }, {"type": "text", "text": "."}]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "For more elaborate overviews of Prometheus, see the resources linked from the "
        }, {
            "type": "text",
            "marks": [{
                "type": "link",
                "attrs": {"href": "https://prometheus.io/docs/introduction/media/", "title": null}
            }],
            "text": "media"
        }, {"type": "text", "text": " section."}]
    }, {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "Features"}]
    }, {"type": "paragraph", "content": [{"type": "text", "text": "Prometheus's main features are:"}]}, {
        "type": "bullet_list",
        "content": [{
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "a multi-dimensional "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://prometheus.io/docs/concepts/data_model/", "title": null}
                    }],
                    "text": "data model"
                }, {"type": "text", "text": " with time series data identified by metric name and key/value pairs"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "PromQL, a "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {
                            "href": "https://prometheus.io/docs/prometheus/latest/querying/basics/",
                            "title": null
                        }
                    }],
                    "text": "flexible query language"
                }, {"type": "text", "text": " to leverage this dimensionality"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "no reliance on distributed storage; single server nodes are autonomous"
                }]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "time series collection happens via a pull model over HTTP"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://prometheus.io/docs/instrumenting/pushing/", "title": null}
                    }],
                    "text": "pushing time series"
                }, {"type": "text", "text": " is supported via an intermediary gateway"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "targets are discovered via service discovery or static configuration"
                }]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "multiple modes of graphing and dashboarding support"}]
            }]
        }]
    }, {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "Components"}]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "The Prometheus ecosystem consists of multiple components, many of which are optional:"
        }]
    }, {
        "type": "bullet_list",
        "content": [{
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "the main "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://github.com/prometheus/prometheus", "title": null}
                    }],
                    "text": "Prometheus server"
                }, {"type": "text", "text": " which scrapes and stores time series data"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://prometheus.io/docs/instrumenting/clientlibs/", "title": null}
                    }],
                    "text": "client libraries"
                }, {"type": "text", "text": " for instrumenting application code"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "a "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://github.com/prometheus/pushgateway", "title": null}
                    }],
                    "text": "push gateway"
                }, {"type": "text", "text": " for supporting short-lived jobs"}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "special-purpose "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://prometheus.io/docs/instrumenting/exporters/", "title": null}
                    }],
                    "text": "exporters"
                }, {"type": "text", "text": " for services like HAProxy, StatsD, Graphite, etc."}]
            }]
        }, {
            "type": "list_item",
            "content": [{
                "type": "paragraph",
                "content": [{"type": "text", "text": "an "}, {
                    "type": "text",
                    "marks": [{
                        "type": "link",
                        "attrs": {"href": "https://github.com/prometheus/alertmanager", "title": null}
                    }],
                    "text": "alertmanager"
                }, {"type": "text", "text": " to handle alerts"}]
            }]
        }, {
            "type": "list_item",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "various support tools"}]}]
        }]
    }, {
        "type": "paragraph",
        "content": [{"type": "text", "text": "Most Prometheus components are written in "}, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "https://golang.org/", "title": null}}],
            "text": "Go"
        }, {"type": "text", "text": ", making them easy to build and deploy as static binaries."}]
    }, {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "Architecture"}]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "This diagram illustrates the architecture of Prometheus and some of its ecosystem components:"
        }]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "image",
            "attrs": {
                "src": "https://prometheus.io/assets/architecture.png",
                "alt": "Prometheus architecture",
                "title": null
            }
        }]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "Prometheus scrapes metrics from instrumented jobs, either directly or via an intermediary push gateway for short-lived jobs. It stores all scraped samples locally and runs rules over this data to either aggregate and record new time series from existing data or generate alerts. "
        }, {
            "type": "text",
            "marks": [{"type": "link", "attrs": {"href": "https://grafana.com/", "title": null}}],
            "text": "Grafana"
        }, {"type": "text", "text": " or other API consumers can be used to visualize the collected data."}]
    }, {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "When does it fit?"}]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "Prometheus works well for recording any purely numeric time series. It fits both machine-centric monitoring as well as monitoring of highly dynamic service-oriented architectures. In a world of microservices, its support for multi-dimensional data collection and querying is a particular strength."
        }]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "Prometheus is designed for reliability, to be the system you go to during an outage to allow you to quickly diagnose problems. Each Prometheus server is standalone, not depending on network storage or other remote services. You can rely on it when other parts of your infrastructure are broken, and you do not need to setup extensive infrastructure to use it."
        }]
    }, {
        "type": "heading",
        "attrs": {"level": 2},
        "content": [{"type": "text", "text": "When does it not fit?"}]
    }, {
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": "Prometheus values reliability. You can always view what statistics are available about your system, even under failure conditions. If you need 100% accuracy, such as for per-request billing, Prometheus is not a good choice as the collected data will likely not be detailed and complete enough. In such a case you would be best off using some other system to collect and analyze the data for billing, and Prometheus for the rest of your monitoring."
        }]
    }]
};
export default prometheus;

